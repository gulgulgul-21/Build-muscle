import type { Backup } from "../../domain/model";
import { mergeData, sameData, type Dataset } from "./merge";
export type RemoteDocument = { revision: number; payload: Backup };
export type SyncBinding = {
  id: "account";
  userId: string;
  revision: number;
  base: Dataset;
  lastSyncedAt: string | null;
};
export interface SyncLocal {
  read(): Promise<{ data: Dataset; binding: SyncBinding | null }>;
  validate(data: Dataset): Dataset;
  accept(
    userId: string,
    expectedRevision: number,
    captured: Dataset,
    remote: RemoteDocument,
  ): Promise<void>;
}
export interface SyncRemote {
  read(): Promise<RemoteDocument | null>;
  write(expectedRevision: number, data: Dataset): Promise<RemoteDocument>;
}
export class SyncConflict extends Error {
  constructor(public paths: string[]) {
    super("ข้อมูลขัดแย้งกัน กรุณาตรวจสอบก่อนซิงก์");
  }
}
export class RevisionConflict extends Error {}
export class SetupRequired extends Error {
  constructor(public remote: RemoteDocument | null) {
    super("เลือกข้อมูลเริ่มต้นก่อนเปิดซิงก์");
  }
}
export async function syncOnce(
  local: SyncLocal,
  remote: SyncRemote,
  userId: string,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const captured = await local.read();
    if (!captured.binding || captured.binding.userId !== userId)
      throw new SetupRequired(await remote.read());
    const cloud = await remote.read();
    if (!cloud) throw new Error("ไม่พบข้อมูลบนคลาวด์ กรุณาเชื่อมบัญชีใหม่");
    const merged = mergeData(
      captured.binding.base,
      captured.data,
      cloud.payload.data,
    );
    if (merged.conflicts.length) throw new SyncConflict(merged.conflicts);
    let data: Dataset;
    try {
      data = local.validate(merged.data);
    } catch {
      throw new SyncConflict(["relationships"]);
    }
    try {
      const acknowledged = sameData(data, cloud.payload.data)
        ? cloud
        : await remote.write(cloud.revision, data);
      await local.accept(
        userId,
        captured.binding.revision,
        captured.data,
        acknowledged,
      );
      return;
    } catch (error) {
      if (error instanceof RevisionConflict) continue;
      throw error;
    }
  }
  throw new Error("ข้อมูลเปลี่ยนระหว่างซิงก์ กรุณาลองอีกครั้ง");
}
