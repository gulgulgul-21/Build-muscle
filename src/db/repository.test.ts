import { beforeEach, describe, it, expect } from "vitest";
import Dexie from "dexie";
import {
  db,
  initialize,
  startSession,
  saveSet,
  closeSession,
  exportBackup,
  importBackup,
  validateBackup,
  saveDay,
  correctSet,
  saveProfile,
  logPain,
  updateBaseline,
  historyCsv,
} from "./repository";
beforeEach(async () => {
  await db.delete();
  await db.open();
  await initialize();
});
describe("data integrity", () => {
  it("migrates version 1 settings without losing workouts or records", async () => {
    const day = (await db.programDays.toArray())[0];
    const session = await startSession(day.id);
    await saveSet({
      sessionId: session.id,
      exerciseId: session.snapshot[0].exerciseId,
      ordinal: 1,
      value: 2,
      weight: 0,
      rir: null,
      modified: false,
    });
    const before = await exportBackup();
    const schema = Object.fromEntries(
      db.tables.map((table) => [
        table.name,
        [
          table.schema.primKey.src,
          ...table.schema.indexes.map((index) => index.src),
        ].join(","),
      ]),
    );
    await db.delete();
    const legacy = new Dexie(db.name);
    legacy.version(1).stores(schema);
    await legacy.open();
    for (const [name, rows] of Object.entries(before.data))
      await legacy.table(name).bulkAdd(
        name === "settings"
          ? rows.map((row) => {
              const old = { ...row };
              Reflect.deleteProperty(old, "language");
              return old;
            })
          : rows,
      );
    legacy.close();
    await db.open();
    expect(db.verno).toBe(2);
    expect((await exportBackup()).data).toEqual(before.data);
  });
  it("keeps A/B/C schedule mapping, respects exclusions and updates baseline provenance", async () => {
    const profile = (await db.profile.toArray())[0];
    await saveProfile({
      ...profile,
      trainingDays: [2, 4, 6],
      excluded: [...profile.excluded, "Pull-up"],
    });
    const days = (await db.programDays.toArray()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    expect(days.map((d) => d.weekday)).toEqual([2, 4, 6]);
    const session = await startSession(days[0].id);
    const pull = (await db.exercises.toArray()).find(
      (e) => e.name === "Pull-up",
    )!;
    expect(session.snapshot.some((t) => t.exerciseId === pull.id)).toBe(false);
    await updateBaseline(pull.id, 2);
    const baseline = await db.personalRecords
      .filter((r) => r.exerciseId === pull.id && r.source === "baseline")
      .first();
    expect(baseline?.value).toBe(2);
    expect(baseline?.source).toBe("baseline");
  });
  it("blocks elbow-provoking sets at the repository boundary", async () => {
    const day = (await db.programDays.toArray()).find((d) => d.weekday === 5)!;
    const session = await startSession(day.id);
    const dip = (await db.exercises.toArray()).find((e) => e.name === "Dip")!;
    await logPain({
      sessionId: session.id,
      exerciseId: dip.id,
      location: "elbow",
      intensity: 3,
      note: "",
    });
    await expect(
      saveSet({
        sessionId: session.id,
        exerciseId: dip.id,
        ordinal: 1,
        value: 5,
        weight: 0,
        rir: null,
        modified: false,
      }),
    ).rejects.toThrow("พักท่านี้");
    expect(await db.sets.count()).toBe(0);
  });
  it("seeds exactly once without replacing edits", async () => {
    const day = (await db.programDays.toArray())[0];
    await saveDay({ ...day, name: "custom" });
    await initialize();
    expect(await db.profile.count()).toBe(1);
    expect((await db.programDays.get(day.id))?.name).toBe("custom");
  });
  it("serializes concurrent starts and saves", async () => {
    const day = (await db.programDays.toArray())[0];
    const [one, two] = await Promise.all([
      startSession(day.id),
      startSession(day.id),
    ]);
    expect(one.id).toBe(two.id);
    const input = {
      sessionId: one.id,
      exerciseId: one.snapshot[0].exerciseId,
      ordinal: 1,
      value: 0,
      weight: 0,
      rir: null,
      modified: false,
    };
    await Promise.all([saveSet(input), saveSet(input)]);
    expect(await db.sets.count()).toBe(1);
    expect((await db.sets.toArray())[0].value).toBe(0);
  });
  it("preserves session snapshots across plan edits and disallows closed writes", async () => {
    const day = (await db.programDays.toArray())[0];
    const session = await startSession(day.id);
    await closeSession(session.id, "completed", "done");
    await saveDay({
      ...day,
      exercises: day.exercises.map((t) => ({
        ...t,
        sets: 1,
        min: 99,
        max: 99,
      })),
    });
    expect((await db.sessions.get(session.id))?.snapshot).toEqual(
      session.snapshot,
    );
    await expect(
      saveSet({
        sessionId: session.id,
        exerciseId: session.snapshot[0].exerciseId,
        ordinal: 1,
        value: 2,
        weight: 0,
        rir: null,
        modified: false,
      }),
    ).rejects.toThrow();
  });
  it("round-trips all tables and corrects set-derived records", async () => {
    const day = (await db.programDays.toArray())[0];
    const session = await startSession(day.id);
    const set = await saveSet({
      sessionId: session.id,
      exerciseId: session.snapshot[0].exerciseId,
      ordinal: 1,
      value: 2,
      weight: 0,
      rir: 2,
      modified: false,
    });
    await correctSet({ ...set, value: 1 });
    expect(
      (await db.personalRecords.filter((r) => r.sourceId === set.id).first())
        ?.value,
    ).toBe(1);
    const backup = await exportBackup();
    await db.sets.clear();
    await importBackup(backup, "replace");
    expect((await exportBackup()).data).toEqual(backup.data);
    await importBackup(backup, "merge");
    expect(await db.sets.count()).toBe(1);
    expect(historyCsv(backup.data)).toContain("reps_or_seconds");
  });
  it("rejects corrupt, negative, orphaned or duplicated data before any write", async () => {
    const before = await exportBackup();
    expect(() => validateBackup({ ...before, schemaVersion: 2 })).toThrow();
    const bad = structuredClone(before);
    bad.data.profile[0].weight = -2;
    await expect(importBackup(bad, "replace")).rejects.toThrow();
    const orphan = structuredClone(before);
    orphan.data.programDays[0].exercises[0].exerciseId = "missing";
    await expect(importBackup(orphan, "replace")).rejects.toThrow();
    const duplicate = structuredClone(before);
    duplicate.data.exercises.push(duplicate.data.exercises[0]);
    expect(() => validateBackup(duplicate)).toThrow();
    expect((await exportBackup()).data).toEqual(before.data);
  });
});
