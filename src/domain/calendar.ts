import { addDays, endOfMonth, startOfMonth, startOfWeek } from "date-fns";
import { localDate, type Day, type Session } from "./model";
export function monthDates(month: Date) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfMonth(month);
  const dates: Date[] = [];
  for (
    let date = start;
    dates.length < 35 || date <= end || dates.length % 7 !== 0;
    date = addDays(date, 1)
  )
    dates.push(date);
  return dates;
}
export function calendarDay(
  date: Date,
  days: Day[],
  sessions: Session[],
  programStart: string,
  today = localDate(),
) {
  const key = localDate(date);
  const plan =
    key >= programStart
      ? days.find((day) => day.weekday === date.getDay())
      : undefined;
  const history = sessions
    .filter((session) => session.scheduledDate === key)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const completed = history.some(
    (session) =>
      session.state === "completed" && (!plan || session.dayId === plan.id),
  );
  const active = history.some(
    (session) =>
      session.state === "active" && (!plan || session.dayId === plan.id),
  );
  const missed =
    !!plan &&
    key < today &&
    !history.some(
      (session) => session.dayId === plan.id && session.state === "completed",
    ) &&
    !active;
  return { key, plan, history, completed, active, missed };
}
