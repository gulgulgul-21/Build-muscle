import { beforeEach, describe, it, expect, vi } from "vitest";
import { seedData as rawSeed } from "../../db/seed";
import { db, initialize, readAll, validateBackup } from "../../db/repository";
import { mergeData, sameData, type Dataset } from "./merge";
import {
  syncOnce,
  RevisionConflict,
  SyncConflict,
  SetupRequired,
  type SyncBinding,
  type SyncLocal,
  type SyncRemote,
  type RemoteDocument,
} from "./engine";
import { localStore, bindAccount, envelope } from "./storage";
function seedData(): Dataset {
  return rawSeed();
}

function device(base: Dataset) {
  let data = structuredClone(base);
  let binding: SyncBinding = {
    id: "account",
    userId: "a",
    revision: 1,
    base: structuredClone(base),
    lastSyncedAt: null,
  };
  const local: SyncLocal = {
    read: async () => structuredClone({ data, binding }),
    validate: (value) => validateBackup(envelope(value)).data,
    accept: async (_user, _revision, captured, remote) => {
      const result = mergeData(captured, data, remote.payload.data);
      if (result.conflicts.length) throw new SyncConflict(result.conflicts);
      data = result.data;
      binding = {
        ...binding,
        revision: remote.revision,
        base: structuredClone(remote.payload.data),
      };
    },
  };
  return {
    local,
    get data() {
      return data;
    },
    set data(value: Dataset) {
      data = value;
    },
  };
}
function server(base: Dataset) {
  let doc: RemoteDocument = {
    revision: 1,
    payload: envelope(structuredClone(base)),
  };
  const remote: SyncRemote = {
    read: async () => structuredClone(doc),
    write: async (revision, data) => {
      if (revision !== doc.revision) throw new RevisionConflict();
      doc = {
        revision: revision + 1,
        payload: envelope(structuredClone(data)),
      };
      return structuredClone(doc);
    },
  };
  return {
    remote,
    get doc() {
      return doc;
    },
    set doc(value: RemoteDocument) {
      doc = value;
    },
  };
}
describe("three-way synchronization", () => {
  it("merges offline edits from two devices without trusting their clocks", async () => {
    const base = seedData();
    const a = device(base),
      b = device(base),
      cloud = server(base);
    a.data.profile[0].weight = 81;
    a.data.profile[0].updatedAt = "2099-01-01T00:00:00.000Z";
    b.data.profile[0].goals = "B goal";
    await syncOnce(a.local, cloud.remote, "a");
    await syncOnce(b.local, cloud.remote, "a");
    await syncOnce(a.local, cloud.remote, "a");
    expect(a.data.profile[0]).toMatchObject({ weight: 81, goals: "B goal" });
    expect(sameData(a.data, b.data)).toBe(true);
  });
  it("retains independently added measurements", () => {
    const base = seedData(),
      a = structuredClone(base),
      b = structuredClone(base);
    const row = {
      id: crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
      date: "2026-10-18",
      kg: 81,
      waist: null,
    };
    a.measurements.push(row);
    b.measurements.push({ ...row, id: crypto.randomUUID(), kg: 82 });
    const result = mergeData(base, a, b);
    expect(result.conflicts).toEqual([]);
    expect(result.data.measurements.length).toBe(base.measurements.length + 2);
  });
  it("stops on concurrent edits to the same field and preserves both sides", async () => {
    const base = seedData(),
      a = device(base),
      cloud = server(base);
    a.data.profile[0].weight = 80;
    cloud.doc.payload.data.profile[0].weight = 90;
    const before = structuredClone(cloud.doc);
    await expect(syncOnce(a.local, cloud.remote, "a")).rejects.toBeInstanceOf(
      SyncConflict,
    );
    expect(a.data.profile[0].weight).toBe(80);
    expect(cloud.doc).toEqual(before);
  });
  it("detects deletion versus edit and treats plan arrays atomically", () => {
    const base = seedData(),
      a = structuredClone(base),
      b = structuredClone(base);
    a.exercises.splice(0, 1);
    b.exercises[0].name = "Changed";
    a.programDays[0].exercises[0].sets = 4;
    b.programDays[0].exercises[1].sets = 5;
    const result = mergeData(base, a, b);
    expect(result.conflicts.some((p) => p.startsWith("exercises."))).toBe(true);
    expect(result.conflicts.some((p) => p.endsWith(".exercises"))).toBe(true);
  });
  it("retries a compare-and-swap race and includes the winning remote edit", async () => {
    const base = seedData(),
      a = device(base),
      cloud = server(base);
    a.data.profile[0].weight = 80;
    const original = cloud.remote.write;
    let first = true;
    cloud.remote.write = async (revision, data) => {
      if (first) {
        first = false;
        cloud.doc = { revision: 2, payload: envelope(structuredClone(base)) };
        cloud.doc.payload.data.profile[0].goals = "Concurrent";
        throw new RevisionConflict();
      }
      return original(revision, data);
    };
    await syncOnce(a.local, cloud.remote, "a");
    expect(cloud.doc.payload.data.profile[0]).toMatchObject({
      weight: 80,
      goals: "Concurrent",
    });
  });
  it("keeps offline changes intact when the network fails", async () => {
    const base = seedData(),
      a = device(base);
    a.data.profile[0].weight = 80;
    const offline: SyncRemote = {
      read: async () => {
        throw new Error("offline");
      },
      write: vi.fn(),
    };
    await expect(syncOnce(a.local, offline, "a")).rejects.toThrow("offline");
    expect(a.data.profile[0].weight).toBe(80);
    expect(offline.write).not.toHaveBeenCalled();
  });
  it("requires explicit setup for a different account before any upload", async () => {
    const base = seedData(),
      a = device(base),
      cloud = server(base);
    const write = vi.spyOn(cloud.remote, "write");
    await expect(syncOnce(a.local, cloud.remote, "b")).rejects.toBeInstanceOf(
      SetupRequired,
    );
    expect(write).not.toHaveBeenCalled();
  });
  it("rejects a merged graph containing two active sessions", async () => {
    const base = seedData(),
      a = device(base),
      cloud = server(base);
    const day = base.programDays[0];
    const session = {
      id: crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
      programId: day.programId,
      dayId: day.id,
      dayName: day.name,
      scheduledDate: "2026-10-18",
      startedAt: new Date().toISOString(),
      completedAt: null,
      state: "active" as const,
      snapshot: day.exercises,
      skipped: [],
      notes: "",
      restEnd: null,
    };
    a.data.sessions.push(session);
    cloud.doc.payload.data.sessions.push({
      ...session,
      id: crypto.randomUUID(),
    });
    await expect(syncOnce(a.local, cloud.remote, "a")).rejects.toBeInstanceOf(
      SyncConflict,
    );
  });
});
describe("transactional device storage", () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await initialize();
  });
  it("preserves edits saved during a network request and queues them for the next sync", async () => {
    const base = await readAll();
    await bindAccount(
      "a",
      base,
      { revision: 1, payload: envelope(base) },
      false,
    );
    const captured = await localStore.read();
    await db.profile.update(base.profile[0].id, { weight: 80 });
    const remote = structuredClone(base);
    remote.profile[0].goals = "From phone";
    await localStore.accept("a", 1, captured.data, {
      revision: 2,
      payload: envelope(remote),
    });
    const result = await localStore.read();
    expect(result.data.profile[0]).toMatchObject({
      weight: 80,
      goals: "From phone",
    });
    expect(result.binding?.base.profile[0].weight).toBe(base.profile[0].weight);
    expect(result.binding?.revision).toBe(2);
  });
  it("rolls back local changes on conflict and refuses stale tab acknowledgements", async () => {
    const base = await readAll();
    await bindAccount(
      "a",
      base,
      { revision: 1, payload: envelope(base) },
      false,
    );
    await db.profile.update(base.profile[0].id, { weight: 80 });
    const remote = structuredClone(base);
    remote.profile[0].weight = 90;
    await expect(
      localStore.accept("a", 1, base, {
        revision: 2,
        payload: envelope(remote),
      }),
    ).rejects.toBeInstanceOf(SyncConflict);
    expect((await localStore.read()).binding?.revision).toBe(1);
    expect((await readAll()).profile[0].weight).toBe(80);
    await expect(
      localStore.accept("a", 2, base, { revision: 3, payload: envelope(base) }),
    ).rejects.toBeInstanceOf(RevisionConflict);
  });
  it("adopts cloud templates on another independently seeded device", async () => {
    const current = await readAll(),
      cloud = seedData();
    expect(current.programDays[0].id).not.toBe(cloud.programDays[0].id);
    await bindAccount(
      "a",
      current,
      { revision: 4, payload: envelope(cloud) },
      true,
    );
    expect(sameData(await readAll(), cloud)).toBe(true);
    expect((await db.syncMeta.get("account"))?.revision).toBe(4);
  });
});
