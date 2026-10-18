import { describe, it, expect } from "vitest";
import { seedData } from "../db/seed";
import {
  localDate,
  weekSchedule,
  completion,
  maxReps,
  totals,
  progression,
  transition,
  type WorkoutSet,
} from "./model";
const data = seedData();
function set(name: string, value: number, weight = 0): WorkoutSet {
  return {
    id: crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    sessionId: "session",
    exerciseId: data.exercises.find((e) => e.name === name)!.id,
    ordinal: 1,
    value,
    weight,
    rir: null,
    completedAt: new Date().toISOString(),
    modified: false,
  };
}
describe("workout metrics", () => {
  it("never sums consecutive PRs across sets", () =>
    expect(
      maxReps([set("Pull-up", 2), set("Pull-up", 2), set("Pull-up", 1)]),
    ).toBe(2));
  it("separates bodyweight reps, per-side reps, hold seconds and external load", () =>
    expect(
      totals(
        [
          set("Pull-up", 2),
          set("Dumbbell Lateral Raise", 12, 10),
          set("Dead Bug", 10),
          set("Hollow Hold", 30),
        ],
        data.exercises,
      ),
    ).toEqual({ reps: 34, externalKg: 120, seconds: 30 }));
  it("uses local date near midnight", () => {
    const date = new Date(2026, 9, 19, 0, 5);
    expect(localDate(date)).toBe("2026-10-19");
  });
  it("maps the weekly schedule correctly across Sunday and month boundaries", () =>
    expect(
      weekSchedule(data.programDays, new Date(2026, 10, 1, 12)).map(
        (d) => d.date,
      ),
    ).toEqual(["2026-10-26", "2026-10-28", "2026-10-30"]));
  it("does not invent completed sessions", () =>
    expect(completion(data.programDays, [], new Date(2026, 9, 19))).toEqual({
      completed: 0,
      scheduled: 3,
    }));
  it("discourages overload with pain", () =>
    expect(progression(true)).toContain("ไม่เพิ่มความหนัก"));
  it("only permits active sessions to close", () => {
    expect(transition("active", "completed")).toBe("completed");
    expect(transition("active", "abandoned")).toBe("abandoned");
    expect(() => transition("completed", "completed")).toThrow();
    expect(() => transition("abandoned", "active")).toThrow();
  });
  it("does not seed excluded exercise or unsupported inverted rows", () => {
    expect(
      data.exercises.some((e) => /Dumbbell Row|Inverted Row/.test(e.name)),
    ).toBe(false);
    expect(data.personalRecords.every((r) => r.source === "baseline")).toBe(
      true,
    );
  });
});
