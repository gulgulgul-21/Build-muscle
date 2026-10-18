import { db, names, readAll, validateBackup } from "../../db/repository";
import type { Backup } from "../../domain/model";
import { mergeData, sameData, type Dataset } from "./merge";
import {
  RevisionConflict,
  SyncConflict,
  type RemoteDocument,
  type SyncLocal,
} from "./engine";
export function envelope(data: Dataset): Backup {
  return {
    schemaVersion: 1,
    appVersion: "1.0.0",
    exportedAt: new Date().toISOString(),
    data,
  };
}
export function validate(data: Dataset) {
  return validateBackup(envelope(data)).data;
}
async function replace(data: Dataset) {
  for (const name of names) {
    await db.table(name).clear();
    await db.table(name).bulkPut(data[name]);
  }
}
export const localStore: SyncLocal = {
  async read() {
    return db.transaction("r", db.tables, async () => ({
      data: await readAll(),
      binding: (await db.syncMeta.get("account")) ?? null,
    }));
  },
  validate,
  async accept(userId, expectedRevision, captured, remote) {
    await db.transaction("rw", db.tables, async () => {
      const binding = await db.syncMeta.get("account");
      if (binding?.userId !== userId || binding.revision !== expectedRevision)
        throw new RevisionConflict();
      const current = await readAll();
      const merged = mergeData(captured, current, remote.payload.data);
      if (merged.conflicts.length) throw new SyncConflict(merged.conflicts);
      validate(merged.data);
      if (!sameData(current, merged.data)) await replace(merged.data);
      await db.syncMeta.put({
        id: "account",
        userId,
        revision: remote.revision,
        base: remote.payload.data,
        lastSyncedAt: new Date().toISOString(),
      });
    });
  },
};
export async function bindAccount(
  userId: string,
  captured: Dataset,
  remote: RemoteDocument,
  replaceLocal: boolean,
) {
  await db.transaction("rw", db.tables, async () => {
    // Never discard a workout saved while a network request was in flight.
    const current = await readAll();
    const merged = replaceLocal
      ? mergeData(captured, current, remote.payload.data)
      : mergeData(captured, current, captured);
    if (merged.conflicts.length) throw new SyncConflict(merged.conflicts);
    await replace(validate(merged.data));
    await db.syncMeta.put({
      id: "account",
      userId,
      revision: remote.revision,
      base: remote.payload.data,
      lastSyncedAt: new Date().toISOString(),
    });
  });
}
