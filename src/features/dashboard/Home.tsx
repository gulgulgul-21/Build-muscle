import { useLanguage } from "../../i18n/LanguageProvider";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CalendarDays,
  Leaf,
  Play,
} from "lucide-react";
import { format, addDays } from "date-fns";

import { useData } from "../../app/context";
import { completion, localDate, weekSchedule } from "../../domain/model";
import { startSession } from "../../db/repository";
import { Heading } from "../../components/ui";
export function Home() {
  const { t: tr, dateLocale } = useLanguage();

  const { data, run, busy } = useData();
  const navigate = useNavigate();
  const today = new Date();
  const active = data.sessions.find((s) => s.state === "active");
  const scheduled = data.programDays.find((d) => d.weekday === today.getDay());
  const status = completion(data.programDays, data.sessions);
  const finished =
    scheduled &&
    data.sessions.some(
      (s) =>
        s.state === "completed" &&
        s.dayId === scheduled.id &&
        s.scheduledDate === localDate(),
    );
  const rest = !scheduled || finished;
  const next = [...data.programDays].sort(
    (a, b) =>
      ((a.weekday - today.getDay() + 7) % 7 || 7) -
      ((b.weekday - today.getDay() + 7) % 7 || 7),
  )[0];
  const day = scheduled && !finished ? scheduled : next;
  const week = weekSchedule(data.programDays);
  const start = async () => {
    if (active) {
      navigate("/workout/active");
      return;
    }
    if (day && (await run(() => startSession(day.id))))
      navigate("/workout/active");
  };
  return (
    <>
      <Heading
        eyebrow={format(today, "EEEE d MMMM yyyy", { locale: dateLocale })}
        title={tr("สม่ำเสมอ ทีละนิด")}
      >
        <span>{tr("พื้นที่เล็ก ๆ สำหรับการฝึกและพัฒนาของคุณ")}</span>
      </Heading>
      <section className="hero">
        <div className="hero-top">
          <span className="eyebrow">
            {active
              ? tr("เซสชันที่ยังฝึกอยู่")
              : rest
                ? "RECOVERY DAY"
                : "TODAY’S SESSION"}
          </span>
          {rest ? <Leaf size={20} /> : <DumbbellIcon />}
        </div>
        <h2>
          {active
            ? active.dayName
            : rest
              ? tr("วันนี้ ให้ร่างกายได้พัก")
              : day?.name}
        </h2>
        <p>
          {active
            ? tr("กลับไปฝึกต่อ ข้อมูลทุกเซตบันทึกไว้แล้ว")
            : rest
              ? tr("เคลื่อนไหวเบา ๆ พักผ่อน และเตรียมพร้อมสำหรับครั้งต่อไป")
              : tr("วอร์มอัพ 5–10 นาที · เหลือแรง 1–3 ครั้งในแต่ละเซต")}
        </p>
        {!rest && (
          <div className="hero-meta">
            <span>
              {day.exercises.length} {tr(" ท่าฝึก")}
            </span>
            <span>
              {day.exercises.reduce((a, t) => a + t.sets, 0)} {tr(" เซต")}
            </span>
            <span>{tr("พัก 2–3 นาที")}</span>
          </div>
        )}
        {active || !rest ? (
          <button
            className="primary wide"
            disabled={busy}
            onClick={() => void start()}
          >
            <Play size={17} />
            {active ? tr("ฝึกต่อ") : tr("เริ่มฝึก")}
            <ArrowRight size={18} />
          </button>
        ) : (
          <Link className="primary wide" to="/workout">
            {tr("ดูแผนการฝึก ")}
            <ArrowRight size={18} />
          </Link>
        )}
        {rest && !active && day && (
          <div className="next-session">
            <CalendarDays size={17} />
            <span>
              {tr("ครั้งถัดไป ·")}{" "}
              {format(
                addDays(today, (day.weekday - today.getDay() + 7) % 7 || 7),
                "EEE d MMM",
                { locale: dateLocale },
              )}
              <strong>{day.name}</strong>
            </span>
          </div>
        )}
      </section>
      <section className="section">
        <div className="section-title">
          <h2>{tr("สัปดาห์นี้")}</h2>
          <span className="muted">
            {status.completed} / {status.scheduled} {tr(" ครั้งที่ฝึก")}
          </span>
        </div>
        <div className="week-grid">
          {week.map((d) => {
            const done = data.sessions.some(
              (s) =>
                s.dayId === d.id &&
                s.scheduledDate === d.date &&
                s.state === "completed",
            );
            return (
              <div className={"week-day " + (done ? "done" : "")} key={d.id}>
                <span className="week-circle">
                  {done ? <Check size={17} /> : d.name.charAt(0)}
                </span>
                <strong>
                  {format(new Date(d.date + "T12:00:00"), "EEEE", {
                    locale: dateLocale,
                  })}
                </strong>
                <small>
                  {done
                    ? tr("ฝึกแล้ว")
                    : d.date < localDate()
                      ? tr("ยังไม่ได้ฝึก")
                      : d.date === localDate()
                        ? tr("วันนี้")
                        : tr("ตามแผน")}
                </small>
              </div>
            );
          })}
        </div>
        <p className="caption">
          {tr("นับตามวันที่กำหนด · ฝึกชดเชยได้โดยเลือกวันที่ในหน้าฝึก")}
        </p>
      </section>
      <section className="section">
        <div className="section-title">
          <h2>{tr("สถิติที่ดีที่สุด")}</h2>
          <Link to="/progress">
            {tr("ดูทั้งหมด ")}
            <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="record-grid">
          {["Push-up", "Pull-up", "Dip"].map((name) => {
            const ex = data.exercises.find((e) => e.name === name);
            const records = data.personalRecords.filter(
              (r) => r.exerciseId === ex?.id,
            );
            const best = records.sort((a, b) => b.value - a.value)[0];
            return (
              <div className="record" key={name}>
                <span>{name}</span>
                <div>
                  <strong>{best?.value ?? "—"}</strong>
                  <small>{tr("ครั้ง")}</small>
                </div>
                <small>
                  {best?.source === "baseline"
                    ? tr("ค่าเริ่มต้น")
                    : tr("สูงสุดต่อเซต")}
                </small>
              </div>
            );
          })}
        </div>
      </section>
      <div className="quiet-note">
        <span className="note-dot" />
        <p>
          {tr("ทุกเซตมีความหมาย")}
          <br />
          <span>{tr("เลือกฟอร์มที่ดี มากกว่าจำนวนที่มากขึ้น")}</span>
        </p>
      </div>
    </>
  );
}
function DumbbellIcon() {
  return <span className="session-letter">A—C</span>;
}
