import { describe, it, expect } from "vitest";
import { calendarDay, monthDates } from "./calendar";
import { localDate, type Session } from "./model";
import { seedData } from "../db/seed";
const data = seedData();
function session(
  date: string,
  state: Session["state"] = "completed",
  weekday = 1,
): Session {
  const day = data.programDays.find((day) => day.weekday === weekday)!;
  return {
    id: "session",
    updatedAt: "2026-10-19T05:00:00.000Z",
    programId: day.programId,
    dayId: day.id,
    dayName: day.name,
    scheduledDate: date,
    startedAt: "2026-10-19T05:00:00.000Z",
    completedAt: state === "active" ? null : "2026-10-19T05:10:00.000Z",
    state,
    snapshot: day.exercises,
    skipped: [],
    notes: "",
    restEnd: null,
  };
}
describe("training calendar", () => {
  it("builds Monday-first complete weeks across leap years and year boundaries", () => {
    const feb = monthDates(new Date(2028, 1, 10));
    expect(feb[0].getDay()).toBe(1);
    expect(feb.length % 7).toBe(0);
    expect(feb.map((date) => localDate(date))).toContain("2028-02-29");
    const january = monthDates(new Date(2027, 0, 1));
    expect(localDate(january[0])).toBe("2026-12-28");
    expect(new Set(january.map((date) => localDate(date))).size).toBe(
      january.length,
    );
  });
  it("never marks unscheduled or pre-program days missed", () => {
    expect(
      calendarDay(
        new Date(2026, 9, 12),
        data.programDays,
        [],
        "2026-10-19",
        "2026-10-22",
      ).plan,
    ).toBeUndefined();
    expect(
      calendarDay(
        new Date(2026, 9, 20),
        data.programDays,
        [],
        "2026-10-12",
        "2026-10-22",
      ).missed,
    ).toBe(false);
  });
  it("counts make-up sessions on assigned dates, without treating other plans as scheduled completion", () => {
    const day = new Date(2026, 9, 12);
    expect(
      calendarDay(day, data.programDays, [], "2026-10-12", "2026-10-19").missed,
    ).toBe(true);
    const done = calendarDay(
      day,
      data.programDays,
      [session("2026-10-12")],
      "2026-10-12",
      "2026-10-19",
    );
    expect(done.completed).toBe(true);
    expect(done.missed).toBe(false);
    expect(
      calendarDay(
        day,
        data.programDays,
        [session("2026-10-12", "completed", 3)],
        "2026-10-12",
        "2026-10-19",
      ).missed,
    ).toBe(true);
  });
  it("keeps active and abandoned history distinct from completed sessions", () => {
    const day = new Date(2026, 9, 12);
    const active = calendarDay(
      day,
      data.programDays,
      [session("2026-10-12", "active")],
      "2026-10-12",
      "2026-10-19",
    );
    expect(active.active).toBe(true);
    expect(active.missed).toBe(false);
    const abandoned = calendarDay(
      day,
      data.programDays,
      [session("2026-10-12", "abandoned")],
      "2026-10-12",
      "2026-10-19",
    );
    expect(abandoned.completed).toBe(false);
    expect(abandoned.history).toHaveLength(1);
    expect(abandoned.missed).toBe(true);
  });
});
