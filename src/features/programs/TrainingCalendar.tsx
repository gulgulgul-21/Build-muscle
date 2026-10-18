import { useEffect, useRef, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import {
  addDays,
  addMonths,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, ArrowRight, Check } from "lucide-react";
import { useData } from "../../app/context";
import { useLanguage } from "../../i18n/LanguageProvider";
import { calendarDay, monthDates } from "../../domain/calendar";
import { localDate } from "../../domain/model";
export function TrainingCalendar({
  selectedDate,
  onSelect,
  onStart,
}: {
  selectedDate: string;
  onSelect: (date: string) => void;
  onStart: (dayId: string) => void;
}) {
  const { data, busy } = useData();
  const { t, dateLocale } = useLanguage();
  const selected = selectedDate ? parseISO(selectedDate) : new Date();
  const month = startOfMonth(selected);
  const today = localDate();
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const keyboardFocus = useRef(false);
  useEffect(() => {
    if (keyboardFocus.current) {
      buttons.current.get(selectedDate)?.focus();
      keyboardFocus.current = false;
    }
  }, [selectedDate]);
  const details = calendarDay(
    selected,
    data.programDays,
    data.sessions,
    data.programs[0].startDate,
    today,
  );
  const active = data.sessions.some((s) => s.state === "active");
  function status(date: Date) {
    const day = calendarDay(
      date,
      data.programDays,
      data.sessions,
      data.programs[0].startDate,
      today,
    );
    return {
      ...day,
      label: day.active
        ? t("กำลังฝึก")
        : day.missed
          ? t("ยังไม่ได้ฝึก")
          : day.completed
            ? t("ฝึกแล้ว")
            : day.plan
              ? t("ตามแผน")
              : t("วันพัก"),
    };
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>, date: Date) {
    let next: Date | undefined;
    switch (event.key) {
      case "ArrowLeft":
        next = addDays(date, -1);
        break;
      case "ArrowRight":
        next = addDays(date, 1);
        break;
      case "ArrowUp":
        next = addDays(date, -7);
        break;
      case "ArrowDown":
        next = addDays(date, 7);
        break;
      case "Home":
        next = startOfWeek(date, { weekStartsOn: 1 });
        break;
      case "End":
        next = endOfWeek(date, { weekStartsOn: 1 });
        break;
      case "PageUp":
        next = addMonths(date, -1);
        break;
      case "PageDown":
        next = addMonths(date, 1);
        break;
    }
    if (next) {
      event.preventDefault();
      keyboardFocus.current = true;
      onSelect(localDate(next));
    }
  }
  return (
    <section className="training-calendar" aria-labelledby="calendar-title">
      <div className="section-title">
        <h2 id="calendar-title">{t("ปฏิทินการฝึก")}</h2>
        <button
          className="calendar-today"
          type="button"
          onClick={() => onSelect(today)}
        >
          {t("วันนี้")}
        </button>
      </div>
      <div className="calendar-month">
        <button
          type="button"
          aria-label={t("เดือนก่อนหน้า")}
          onClick={() => onSelect(localDate(addMonths(month, -1)))}
        >
          <ChevronLeft size={18} />
        </button>
        <h3 aria-live="polite">
          {format(month, "LLLL yyyy", { locale: dateLocale })}
        </h3>
        <button
          type="button"
          aria-label={t("เดือนถัดไป")}
          onClick={() => onSelect(localDate(addMonths(month, 1)))}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i}>
            {format(
              addDays(startOfWeek(selected, { weekStartsOn: 1 }), i),
              "EEEEEE",
              { locale: dateLocale },
            )}
          </span>
        ))}
      </div>
      <div
        className="calendar-grid"
        role="group"
        aria-label={t("วันที่ในปฏิทิน")}
      >
        {monthDates(month).map((date) => {
          const day = status(date);
          const isSelected = day.key === selectedDate;
          return (
            <button
              type="button"
              key={day.key}
              data-date={day.key}
              ref={(element) => {
                if (element) buttons.current.set(day.key, element);
                else buttons.current.delete(day.key);
              }}
              tabIndex={
                isSelected || (!selectedDate && day.key === today) ? 0 : -1
              }
              aria-label={`${format(date, "EEEE d MMMM yyyy", { locale: dateLocale })} · ${day.label}${day.plan ? " · " + day.plan.name : ""}`}
              aria-pressed={isSelected}
              aria-current={day.key === today ? "date" : undefined}
              className={[
                "calendar-cell",
                !isSameMonth(date, month) ? "outside" : "",
                isSelected ? "selected" : "",
                day.active
                  ? "active-session"
                  : day.completed
                    ? "completed"
                    : day.missed
                      ? "missed"
                      : day.plan
                        ? "planned"
                        : "",
              ].join(" ")}
              onClick={() => onSelect(day.key)}
              onKeyDown={(event) => navigate(event, date)}
            >
              <span>{format(date, "d")}</span>
              <small aria-hidden="true">
                {day.active ? (
                  "●"
                ) : day.completed ? (
                  <Check size={12} />
                ) : day.missed ? (
                  "–"
                ) : (
                  day.plan?.name.charAt(0) || " "
                )}
              </small>
            </button>
          );
        })}
      </div>
      <div className="calendar-legend">
        <span>
          <i className="legend-planned" />
          {t("ตามแผน")}
        </span>
        <span>
          <i className="legend-completed" />
          {t("ฝึกแล้ว")}
        </span>
        <span>
          <i className="legend-missed" />
          {t("ยังไม่ได้ฝึก")}
        </span>
        <span>
          <i className="legend-active" />
          {t("กำลังฝึก")}
        </span>
      </div>
      <div className="calendar-details" aria-live="polite">
        <h3>{format(selected, "EEEE d MMMM yyyy", { locale: dateLocale })}</h3>
        {details.plan ? (
          <p className="muted">
            {details.plan.name} · {status(selected).label}
          </p>
        ) : (
          <p className="muted">
            {t("วันพัก · เลือกแผน A / B / C ด้านล่างหากต้องการฝึกเอง")}
          </p>
        )}
        {details.plan &&
          !details.history.some(
            (s) => s.dayId === details.plan?.id && s.state === "completed",
          ) && (
            <button
              className="primary wide"
              type="button"
              disabled={busy || !selectedDate}
              aria-label={t("เริ่มฝึกวันที่เลือก")}
              onClick={() => onStart(details.plan!.id)}
            >
              {active
                ? t("กลับไปเซสชันที่กำลังฝึก")
                : t(
                    details.missed ? "ฝึกชดเชย {0}" : "เริ่มฝึก {0}",
                    details.plan.name[0],
                  )}
              <ArrowRight size={16} />
            </button>
          )}
        {details.history.map((session) => (
          <Link
            className="calendar-session"
            key={session.id}
            to={
              session.state === "active"
                ? "/workout/active"
                : `/workout/summary/${session.id}`
            }
          >
            <span>
              {session.dayName}
              <small>
                {t(
                  session.state === "active"
                    ? "กำลังฝึก"
                    : session.state === "completed"
                      ? "ฝึกแล้ว"
                      : "ยกเลิก",
                )}{" "}
                · {data.sets.filter((s) => s.sessionId === session.id).length}{" "}
                {t("เซต")}
              </small>
            </span>
            <ArrowRight size={16} />
          </Link>
        ))}
        <p className="caption">
          {t(
            "ปฏิทินใช้วันที่กำหนดของเซสชัน การฝึกชดเชยจะแสดงบนวันที่ที่เลือก ประวัติเดิมไม่เปลี่ยนเมื่อแก้แผน",
          )}
        </p>
      </div>
    </section>
  );
}
