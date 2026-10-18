import Dexie, { type Table } from "dexie";
import {
  backupSchema,
  sessionSchema,
  setSchema,
  painSchema,
  profileSchema,
  daySchema,
  recordSchema,
  measurementSchema,
  settingsSchema,
  programSchema,
  id,
  now,
  localDate,
  transition,
  type Profile,
  type Exercise,
  type Program,
  type Day,
  type Session,
  type WorkoutSet,
  type Pain,
  type RecordEntry,
  type Measurement,
  type Settings,
  type Backup,
} from "../domain/model";
import { seedData } from "./seed";
import type { SyncBinding } from "../features/sync/engine";
class Database extends Dexie {
  profile!: Table<Profile>;
  exercises!: Table<Exercise>;
  programs!: Table<Program>;
  programDays!: Table<Day>;
  sessions!: Table<Session>;
  sets!: Table<WorkoutSet>;
  painLogs!: Table<Pain>;
  measurements!: Table<Measurement>;
  personalRecords!: Table<RecordEntry>;
  settings!: Table<Settings>;
  syncMeta!: Table<SyncBinding>;
  constructor() {
    super("form-calisthenics");
    this.version(1).stores({
      profile: "id",
      exercises: "id,name,category",
      programs: "id,active",
      programDays: "id,programId,weekday",
      sessions: "id,state,scheduledDate,startedAt",
      sets: "id,sessionId,exerciseId,&[sessionId+exerciseId+ordinal]",
      painLogs: "id,sessionId,exerciseId",
      measurements: "id,date",
      personalRecords: "id,exerciseId,occurredAt",
      settings: "id",
    });
    this.version(2)
      .stores({ settings: "id" })
      .upgrade((tx) =>
        tx.table("settings").toCollection().modify({ language: "th" }),
      );
    this.version(3).stores({ syncMeta: "id" });
  }
}
export const db = new Database();
export const names = [
  "profile",
  "exercises",
  "programs",
  "programDays",
  "sessions",
  "sets",
  "painLogs",
  "measurements",
  "personalRecords",
  "settings",
] as const;
export async function initialize() {
  await db.transaction("rw", db.tables, async () => {
    if (await db.profile.count()) return;
    const seed = seedData();
    for (const key of names) await db.table(key).bulkAdd(seed[key]);
  });
}
export async function readAll() {
  const data: { [key: string]: unknown } = {};
  await db.transaction("r", db.tables, async () => {
    for (const key of names) data[key] = await db.table(key).toArray();
  });
  const result = data as Backup["data"];
  result.programDays.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}
export async function startSession(dayId: string, scheduledDate = localDate()) {
  return db.transaction(
    "rw",
    [db.sessions, db.programDays, db.profile, db.exercises],
    async () => {
      const active = await db.sessions.where("state").equals("active").first();
      if (active) return active;
      const day = await db.programDays.get(dayId);
      if (!day) throw new Error("ไม่พบแผน");
      const profile = await db.profile.toCollection().first();
      const exercises = await db.exercises.toArray();
      const targets = day.exercises.filter(
        (t) =>
          !profile?.excluded.includes(
            exercises.find((e) => e.id === t.exerciseId)?.name || "",
          ),
      );
      if (!targets.length)
        throw new Error("ไม่มีท่าที่อนุญาตในแผนนี้ กรุณาแก้ไขแผนก่อน");
      const session = sessionSchema.parse({
        id: id(),
        updatedAt: now(),
        programId: day.programId,
        dayId: day.id,
        dayName: day.name,
        scheduledDate,
        startedAt: now(),
        completedAt: null,
        state: "active",
        snapshot: structuredClone(targets),
        skipped: [],
        notes: "",
        restEnd: null,
      });
      await db.sessions.add(session);
      return session;
    },
  );
}
export async function saveSet(
  input: Omit<WorkoutSet, "id" | "updatedAt" | "completedAt">,
) {
  return db.transaction(
    "rw",
    [
      db.sessions,
      db.sets,
      db.personalRecords,
      db.exercises,
      db.painLogs,
      db.settings,
    ],
    async () => {
      const session = await db.sessions.get(input.sessionId);
      if (!session || session.state !== "active")
        throw new Error("เซสชันนี้ปิดแล้ว");
      const target = session.snapshot.find(
        (t) => t.exerciseId === input.exerciseId,
      );
      if (!target || input.ordinal > target.sets)
        throw new Error("เซตไม่อยู่ในแผน");
      const existing = await db.sets
        .where("[sessionId+exerciseId+ordinal]")
        .equals([input.sessionId, input.exerciseId, input.ordinal])
        .first();
      if (existing) return existing;
      const exercise = await db.exercises.get(input.exerciseId);
      if (session.skipped.includes(input.exerciseId))
        throw new Error("ท่านี้ข้ามแล้ว");
      const elbow = await db.painLogs
        .filter((p) => p.sessionId === session.id && p.location === "elbow")
        .count();
      if (elbow && ["Dip", "Negative Pull-up"].includes(exercise?.name || ""))
        throw new Error("พักท่านี้เมื่อมีอาการเจ็บศอก");
      const set = setSchema.parse({
        ...input,
        id: id(),
        updatedAt: now(),
        completedAt: now(),
      });
      await db.sets.add(set);
      await db.personalRecords.add({
        id: id(),
        updatedAt: now(),
        exerciseId: set.exerciseId,
        metric: exercise?.modality === "hold" ? "seconds" : "reps",
        value: set.value,
        occurredAt: set.completedAt,
        source: "set",
        sourceId: set.id,
      });
      const settings = await db.settings.toCollection().first();
      await db.sessions.update(session.id, {
        restEnd: settings?.timer ? Date.now() + target.rest * 1000 : null,
        updatedAt: now(),
      });
      return set;
    },
  );
}
export async function correctSet(set: WorkoutSet) {
  const valid = setSchema.parse({ ...set, modified: true, updatedAt: now() });
  await db.transaction("rw", db.sets, db.personalRecords, async () => {
    await db.sets.put(valid);
    await db.personalRecords
      .filter((r) => r.sourceId === valid.id)
      .modify({ value: valid.value, updatedAt: now() });
  });
}
export async function closeSession(
  sessionId: string,
  state: "completed" | "abandoned",
  notes: string,
) {
  await db.transaction("rw", db.sessions, async () => {
    const s = await db.sessions.get(sessionId);
    if (!s) throw new Error("ไม่พบเซสชัน");
    await db.sessions.update(s.id, {
      state: transition(s.state, state),
      notes,
      restEnd: null,
      completedAt: now(),
      updatedAt: now(),
    });
  });
}
export async function skipExercise(sessionId: string, exerciseId: string) {
  await db.transaction("rw", db.sessions, async () => {
    const s = await db.sessions.get(sessionId);
    if (s?.state !== "active") throw new Error("เซสชันนี้ปิดแล้ว");
    await db.sessions.update(s.id, {
      skipped: [...new Set([...s.skipped, exerciseId])],
      updatedAt: now(),
    });
  });
}
export async function swapExercise(
  sessionId: string,
  from: string,
  to: string,
) {
  await db.transaction(
    "rw",
    [db.sessions, db.profile, db.exercises, db.sets],
    async () => {
      const s = await db.sessions.get(sessionId);
      const ex = await db.exercises.get(to);
      const p = await db.profile.toCollection().first();
      if (!s || s.state !== "active" || !ex || p?.excluded.includes(ex.name))
        throw new Error("ไม่สามารถเปลี่ยนท่านี้ได้");
      if (
        s.snapshot.some((t) => t.exerciseId === to) ||
        (await db.sets
          .filter((t) => t.sessionId === s.id && t.exerciseId === from)
          .count())
      )
        throw new Error("เปลี่ยนท่าก่อนบันทึกเซต หรือข้ามท่าแทน");
      await db.sessions.update(s.id, {
        snapshot: s.snapshot.map((t) =>
          t.exerciseId === from ? { ...t, exerciseId: to } : t,
        ),
        updatedAt: now(),
      });
    },
  );
}
export async function stopTimer(sessionId: string) {
  await db.sessions.update(sessionId, { restEnd: null, updatedAt: now() });
}
export async function saveSessionNotes(sessionId: string, notes: string) {
  await db.sessions.update(sessionId, { notes, updatedAt: now() });
}
export async function updateBaseline(exerciseId: string, value: number) {
  await db.transaction("rw", db.personalRecords, async () => {
    const record = await db.personalRecords
      .filter((r) => r.exerciseId === exerciseId && r.source === "baseline")
      .first();
    await db.personalRecords.put(
      recordSchema.parse({
        id: record?.id || id(),
        exerciseId,
        value,
        metric: "reps",
        source: "baseline",
        sourceId: null,
        occurredAt: record?.occurredAt || now(),
        updatedAt: now(),
      }),
    );
  });
}
export async function logPain(value: Omit<Pain, "id" | "updatedAt">) {
  await db.painLogs.add(
    painSchema.parse({ ...value, id: id(), updatedAt: now() }),
  );
}
export async function saveProfile(profile: Profile) {
  await db.transaction("rw", db.profile, db.programDays, async () => {
    await db.profile.put(
      profileSchema.parse({
        ...profile,
        equipment: profile.equipment.map((e) => e.trim()).filter(Boolean),
        excluded: profile.excluded.map((e) => e.trim()).filter(Boolean),
        updatedAt: now(),
      }),
    );
    const days = (await db.programDays.toArray()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (let i = 0; i < days.length; i++)
      await db.programDays.update(days[i].id, {
        weekday: profile.trainingDays[i],
        updatedAt: now(),
      });
  });
}
export async function saveDay(day: Day) {
  await db.programDays.put(daySchema.parse({ ...day, updatedAt: now() }));
}
export async function saveProgram(program: Program) {
  await db.programs.put(programSchema.parse({ ...program, updatedAt: now() }));
}
export async function saveSettings(settings: Settings) {
  await db.settings.put(
    settingsSchema.parse({ ...settings, updatedAt: now() }),
  );
}
export async function addRecord(
  record: Omit<RecordEntry, "id" | "updatedAt" | "occurredAt" | "sourceId">,
) {
  await db.personalRecords.add(
    recordSchema.parse({
      ...record,
      id: id(),
      updatedAt: now(),
      occurredAt: now(),
      sourceId: null,
    }),
  );
}
export async function addMeasurement(kg: number, waist: number | null) {
  await db.measurements.add(
    measurementSchema.parse({
      id: id(),
      updatedAt: now(),
      date: localDate(),
      kg,
      waist,
    }),
  );
}
export async function exportBackup() {
  return backupSchema.parse({
    schemaVersion: 1,
    appVersion: "1.0.0",
    exportedAt: now(),
    data: await readAll(),
  });
}
export function validateBackup(raw: unknown): Backup {
  const b = backupSchema.parse(raw);
  const d = b.data;
  if (
    d.programs.length !== 1 ||
    !d.programs[0].active ||
    d.programDays.length !== 3 ||
    new Set(d.programDays.map((day) => day.weekday)).size !== 3
  )
    throw new Error(
      "ไฟล์ต้องมีแผนเดียวและวันฝึก 3 วัน การรวมแผนคนละชุดไม่รองรับ กรุณาใช้แทนที่หลังสำรอง",
    );
  for (const day of d.programDays)
    if (
      new Set(day.exercises.map((t) => t.exerciseId)).size !==
      day.exercises.length
    )
      throw new Error("ท่าซ้ำในวันฝึก");
  for (const session of d.sessions)
    if (
      (session.state === "active") !== (session.completedAt === null) ||
      (session.completedAt && session.completedAt < session.startedAt)
    )
      throw new Error("สถานะหรือเวลาของเซสชันไม่ถูกต้อง");
  for (const name of names) {
    const ids = d[name].map((r) => r.id);
    if (new Set(ids).size !== ids.length) throw new Error("พบ ID ซ้ำ");
  }
  if (d.sessions.filter((s) => s.state === "active").length > 1)
    throw new Error("มีเซสชันที่ยังฝึกหลายรายการ");
  const ex = new Set(d.exercises.map((e) => e.id)),
    sessions = new Set(d.sessions.map((s) => s.id)),
    programs = new Set(d.programs.map((p) => p.id)),
    days = new Set(d.programDays.map((p) => p.id));
  for (const day of d.programDays)
    if (
      !programs.has(day.programId) ||
      day.exercises.some((t) => !ex.has(t.exerciseId))
    )
      throw new Error("แผนอ้างอิงข้อมูลที่ไม่พบ");
  for (const s of d.sessions)
    if (
      !days.has(s.dayId) ||
      !programs.has(s.programId) ||
      s.snapshot.some((t) => !ex.has(t.exerciseId)) ||
      new Set(s.snapshot.map((t) => t.exerciseId)).size !== s.snapshot.length ||
      s.skipped.some((e) => !s.snapshot.some((t) => t.exerciseId === e))
    )
      throw new Error("เซสชันอ้างอิงข้อมูลที่ไม่พบ");
  for (const row of [...d.sets, ...d.painLogs])
    if (!sessions.has(row.sessionId) || !ex.has(row.exerciseId))
      throw new Error("ประวัติอ้างอิงข้อมูลที่ไม่พบ");
  for (const set of d.sets) {
    const session = d.sessions.find((s) => s.id === set.sessionId);
    const target = session?.snapshot.find(
      (t) => t.exerciseId === set.exerciseId,
    );
    if (!target || set.ordinal > target.sets)
      throw new Error("เซตไม่ตรงกับ snapshot");
  }
  for (const r of d.personalRecords)
    if (
      !ex.has(r.exerciseId) ||
      (r.source === "set" && !d.sets.some((s) => s.id === r.sourceId))
    )
      throw new Error("สถิติอ้างอิงข้อมูลที่ไม่พบ");
  const keys = d.sets.map((s) => `${s.sessionId}/${s.exerciseId}/${s.ordinal}`);
  if (new Set(keys).size !== keys.length) throw new Error("พบเซตซ้ำ");
  return b;
}
export async function importBackup(raw: unknown, mode: "merge" | "replace") {
  const b = validateBackup(raw);
  await db.transaction("rw", db.tables, async () => {
    if (mode === "merge") {
      const current = await readAll();
      const merged = { ...b, data: { ...current } };
      for (const name of names) {
        const map = new Map(current[name].map((r) => [r.id, r]));
        for (const row of b.data[name]) {
          const old = map.get(row.id);
          if (!old || row.updatedAt > old.updatedAt) map.set(row.id, row);
        }
        Object.assign(merged.data, { [name]: [...map.values()] });
      }
      validateBackup(merged);
      for (const name of names) await db.table(name).bulkPut(merged.data[name]);
    } else {
      for (const name of names) {
        await db.table(name).clear();
        await db.table(name).bulkAdd(b.data[name]);
      }
    }
  });
}
export async function resetData() {
  await db.transaction("rw", db.tables, async () => {
    for (const name of names) await db.table(name).clear();
  });
  await initialize();
}
export function download(
  name: string,
  contents: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob(["\ufeff", contents], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function historyCsv(data: Backup["data"]) {
  const cell = (v: unknown) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
  return [
    [
      "date",
      "session",
      "exercise",
      "set",
      "reps_or_seconds",
      "unit",
      "external_kg",
      "RIR",
      "state",
    ],
    ...data.sets.map((s) => {
      const session = data.sessions.find((x) => x.id === s.sessionId),
        ex = data.exercises.find((x) => x.id === s.exerciseId);
      return [
        session?.scheduledDate,
        session?.dayName,
        ex?.name,
        s.ordinal,
        s.value,
        ex?.modality === "hold"
          ? "seconds"
          : ex?.perSide
            ? "reps/side"
            : "reps",
        s.weight,
        s.rir,
        session?.state,
      ];
    }),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
