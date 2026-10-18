import { z } from "zod";
import { format, startOfWeek, addDays } from "date-fns";
export const id = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export const localDate = (date = new Date()) => format(date, "yyyy-MM-dd");
const n = z.number().finite().nonnegative();
const integer = n.int().max(10000);
const stamp = z.string().datetime();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(new Date(v + "T12:00:00").getTime()) &&
      localDate(new Date(v + "T12:00:00")) === v,
    "Invalid date",
  );
const entity = { id: z.string().min(1), updatedAt: stamp };
export const profileSchema = z.object({
  ...entity,
  weight: n.positive().max(500),
  height: n.positive().max(300),
  equipment: z.array(z.string()),
  goals: z.string(),
  excluded: z.array(z.string()),
  trainingDays: z
    .array(z.number().int().min(0).max(6))
    .length(3)
    .refine((a) => new Set(a).size === 3),
});
export const exerciseSchema = z.object({
  ...entity,
  name: z.string().min(1),
  category: z.string(),
  instructions: z.string(),
  equipment: z.array(z.string()),
  precautions: z.string(),
  easier: z.string(),
  harder: z.string(),
  modality: z.enum(["reps", "hold", "weighted"]),
  perSide: z.boolean(),
});
export const targetSchema = z
  .object({
    exerciseId: z.string(),
    sets: integer.min(1).max(20),
    min: integer.max(999),
    max: integer.max(999),
    rest: integer.max(900),
  })
  .refine((v) => v.max >= v.min);
export const programSchema = z.object({
  ...entity,
  name: z.string(),
  startDate: date,
  duration: z.literal(4),
  active: z.boolean(),
  templateVersion: z.literal(1),
});
export const daySchema = z.object({
  ...entity,
  programId: z.string(),
  weekday: z.number().int().min(0).max(6),
  name: z.string(),
  exercises: z.array(targetSchema).min(1),
});
export const sessionSchema = z.object({
  ...entity,
  programId: z.string(),
  dayId: z.string(),
  dayName: z.string(),
  scheduledDate: date,
  startedAt: stamp,
  completedAt: stamp.nullable(),
  state: z.enum(["active", "completed", "abandoned"]),
  snapshot: z.array(targetSchema).min(1),
  skipped: z.array(z.string()),
  notes: z.string(),
  restEnd: n.nullable(),
});
export const setSchema = z.object({
  ...entity,
  sessionId: z.string(),
  exerciseId: z.string(),
  ordinal: integer.min(1),
  value: integer.max(9999),
  weight: n.max(1000),
  rir: integer.max(10).nullable(),
  completedAt: stamp,
  modified: z.boolean(),
});
export const painSchema = z.object({
  ...entity,
  sessionId: z.string(),
  exerciseId: z.string(),
  location: z.enum(["elbow", "lower back", "shoulder", "other"]),
  intensity: integer.min(1).max(10),
  note: z.string(),
});
export const recordSchema = z.object({
  ...entity,
  exerciseId: z.string(),
  metric: z.enum(["reps", "seconds"]),
  value: integer,
  occurredAt: stamp,
  source: z.enum(["baseline", "test", "set"]),
  sourceId: z.string().nullable(),
});
export const measurementSchema = z.object({
  ...entity,
  date,
  kg: n.positive().max(500),
  waist: n.positive().max(300).nullable(),
});
export const settingsSchema = z.object({
  ...entity,
  language: z.enum(["th", "en"]).default("th"),
  theme: z.literal("light"),
  timer: z.boolean(),
  vibration: z.boolean(),
  units: z.literal("metric"),
  reminders: z.boolean(),
  lastBackup: stamp.nullable(),
});
export const backupSchema = z.object({
  schemaVersion: z.literal(1),
  appVersion: z.literal("1.0.0"),
  exportedAt: stamp,
  data: z.object({
    profile: z.array(profileSchema).length(1),
    exercises: z.array(exerciseSchema),
    programs: z.array(programSchema),
    programDays: z.array(daySchema),
    sessions: z.array(sessionSchema),
    sets: z.array(setSchema),
    painLogs: z.array(painSchema),
    measurements: z.array(measurementSchema),
    personalRecords: z.array(recordSchema),
    settings: z.array(settingsSchema).length(1),
  }),
});
export type Profile = z.infer<typeof profileSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type Target = z.infer<typeof targetSchema>;
export type Program = z.infer<typeof programSchema>;
export type Day = z.infer<typeof daySchema>;
export type Session = z.infer<typeof sessionSchema>;
export type WorkoutSet = z.infer<typeof setSchema>;
export type Pain = z.infer<typeof painSchema>;
export type RecordEntry = z.infer<typeof recordSchema>;
export type Measurement = z.infer<typeof measurementSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Backup = z.infer<typeof backupSchema>;
export function maxReps(sets: WorkoutSet[]) {
  return Math.max(0, ...sets.map((s) => s.value));
}
export function totals(sets: WorkoutSet[], exercises: Exercise[]) {
  return sets.reduce(
    (a, s) => {
      const ex = exercises.find((e) => e.id === s.exerciseId);
      if (ex?.modality === "hold") a.seconds += s.value;
      else {
        a.reps += s.value * (ex?.perSide ? 2 : 1);
        if (ex?.modality === "weighted")
          a.externalKg += s.value * s.weight * (ex.perSide ? 2 : 1);
      }
      return a;
    },
    { reps: 0, seconds: 0, externalKg: 0 },
  );
}
export function weekSchedule(days: Day[], today = new Date()) {
  const start = startOfWeek(today, { weekStartsOn: 1 });
  return days
    .map((d) => ({
      ...d,
      date: localDate(addDays(start, (d.weekday + 6) % 7)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function completion(
  days: Day[],
  sessions: Session[],
  today = new Date(),
) {
  const schedule = weekSchedule(days, today);
  return {
    completed: schedule.filter((d) =>
      sessions.some(
        (s) =>
          s.state === "completed" &&
          s.dayId === d.id &&
          s.scheduledDate === d.date,
      ),
    ).length,
    scheduled: schedule.length,
  };
}
export function progression(hasPain: boolean) {
  return hasPain
    ? "พักท่าที่กระตุ้นอาการ ไม่เพิ่มความหนัก เลือกทดแทนเฉพาะเมื่อไม่เจ็บ"
    : "รักษาฟอร์มและเหลือแรง 1–3 ครั้ง เพิ่มเมื่อถึงขอบบนของช่วงอย่างควบคุมได้";
}
export function transition(current: Session["state"], next: Session["state"]) {
  if (current !== "active" || next === "active")
    throw new Error("Session is already closed");
  return next;
}
