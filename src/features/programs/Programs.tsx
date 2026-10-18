import { useLanguage } from "../../i18n/LanguageProvider";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
} from "lucide-react";
import { useData } from "../../app/context";
import { Heading, Back, weekdayNames, NumberField } from "../../components/ui";
import { startSession, saveDay, saveProgram } from "../../db/repository";
import { localDate, type Day } from "../../domain/model";
export const guidance = [
  "สัปดาห์ 1 · เรียนรู้ฟอร์มและเก็บค่าตั้งต้น ฝึกตามแผน 3 ครั้ง",
  "สัปดาห์ 2 · เพิ่มจำนวนที่มีคุณภาพเล็กน้อย เมื่อฟื้นตัวดี",
  "สัปดาห์ 3 · เพิ่มเมื่อถึงขอบบนของช่วงและคุมฟอร์มได้",
  "สัปดาห์ 4 · ลดปริมาณต้นสัปดาห์ 20–30% และทดสอบ max ต่อเซตเมื่อสด",
];
export function WorkoutHub() {
  const { t: tr } = useLanguage();

  const { data, run, busy } = useData();
  const navigate = useNavigate();
  const [date, setDate] = useState(localDate());
  const active = data.sessions.find((s) => s.state === "active");
  return (
    <>
      <Heading eyebrow="YOUR PRACTICE" title={tr("แผนการฝึก")}>
        {tr("พื้นฐานที่แข็งแรง เริ่มจากการทำซ้ำอย่างมีคุณภาพ")}
      </Heading>
      {active && (
        <Link className="resume primary" to="/workout/active">
          {tr("ฝึกต่อ · ")}
          {active.dayName}
          <ArrowRight size={18} />
        </Link>
      )}
      <div className="toolbar">
        <Link to="/workout/plan">
          <SlidersHorizontal size={17} />
          {tr("แก้ไขแผน")}
        </Link>
        <Link to="/workout/library">
          <BookOpen size={17} />
          {tr("คลังท่าฝึก")}
        </Link>
      </div>
      <label className="date-field">
        {tr("วันที่ฝึกตามกำหนด / ฝึกชดเชย")}
        <input
          type="date"
          value={date}
          required
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <div className="plan-list">
        {[...data.programDays]
          .sort((a, b) => a.weekday - b.weekday)
          .map((day) => (
            <section className="plan-day" key={day.id}>
              <div className="section-title">
                <div>
                  <p className="eyebrow">
                    {tr("วัน{0}", tr(weekdayNames[day.weekday]))}
                  </p>
                  <h2>{day.name}</h2>
                </div>
                <span className="day-letter">{day.name[0]}</span>
              </div>
              {day.exercises.map((t) => {
                const ex = data.exercises.find((e) => e.id === t.exerciseId);
                return (
                  <div className="exercise-row" key={t.exerciseId}>
                    <span>{ex?.name}</span>
                    <span className="muted">
                      {t.sets} × {t.min}
                      {t.min !== t.max ? `–${t.max}` : ""}{" "}
                      {ex?.modality === "hold"
                        ? tr("วิ")
                        : ex?.perSide
                          ? tr("/ข้าง")
                          : ""}
                    </span>
                  </div>
                );
              })}
              <button
                className="secondary wide"
                disabled={busy || !date}
                onClick={() =>
                  void run(async () => {
                    await startSession(day.id, date);
                    navigate("/workout/active");
                  })
                }
              >
                {active
                  ? tr("กลับไปเซสชันที่กำลังฝึก")
                  : tr("เริ่มฝึก {0}", day.name[0])}
                <ArrowRight size={17} />
              </button>
            </section>
          ))}
      </div>
      <section className="section">
        <h2>{tr("แนวทาง 4 สัปดาห์")}</h2>
        <p className="muted">
          {tr("เริ่ม ")}
          {data.programs[0]?.startDate} {tr(" · คำแนะนำ ปรับตามความพร้อม")}
        </p>
        {guidance.map((g, i) => (
          <p className="guidance" key={g}>
            <span>0{i + 1}</span>
            {tr(g)}
          </p>
        ))}
        <p className="caption">
          {tr("วอร์มอัพ 5–10 นาที · วันพัก: เคลื่อนไหวเบา ๆ ตามสบาย")}
          <br />
          {tr(
            "เป้าหมายที่คาดหวัง: Push-up 18–22, Pull-up 4–5, Dip 12–15 ไม่รับประกันผลและไม่เพิ่มเป้าอัตโนมัติ",
          )}
        </p>
      </section>
    </>
  );
}
export function PlanEditor() {
  const { t: tr } = useLanguage();

  const { data } = useData();
  return (
    <>
      <Back />
      <Heading eyebrow="MAKE IT YOURS" title={tr("แก้ไขแผน")}>
        {tr(
          "การเปลี่ยนแปลงใช้กับเซสชันใหม่ ประวัติและเซสชันที่เริ่มแล้วเก็บเป้าเดิม",
        )}
      </Heading>
      <ProgramDates />
      {data.programDays.map((day) => (
        <DayEditor key={day.id + day.updatedAt} original={day} />
      ))}
    </>
  );
}
function ProgramDates() {
  const { t: tr } = useLanguage();

  const { data, run, busy } = useData();
  const program = data.programs[0];
  const [date, setDate] = useState(program.startDate);
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => saveProgram({ ...program, startDate: date }));
      }}
    >
      <label>
        {tr("วันเริ่มแผน 4 สัปดาห์")}
        <input
          type="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <button className="secondary" disabled={busy}>
        {tr("บันทึกวันที่")}
      </button>
    </form>
  );
}
function DayEditor({ original }: { original: Day }) {
  const { t: tr } = useLanguage();

  const { data, run, busy } = useData();
  const [day, setDay] = useState(structuredClone(original));
  const [saved, setSaved] = useState(false);
  const [add, setAdd] = useState("");
  const available = data.exercises.filter(
    (e) =>
      !data.profile[0].excluded.includes(e.name) &&
      !day.exercises.some((t) => t.exerciseId === e.id),
  );
  const update = (
    index: number,
    key: "sets" | "min" | "max" | "rest",
    value: string,
  ) => {
    setSaved(false);
    setDay({
      ...day,
      exercises: day.exercises.map((t, i) =>
        i === index ? { ...t, [key]: value === "" ? NaN : Number(value) } : t,
      ),
    });
  };
  const move = (index: number, delta: number) => {
    const exercises = [...day.exercises];
    [exercises[index], exercises[index + delta]] = [
      exercises[index + delta],
      exercises[index],
    ];
    setDay({ ...day, exercises });
    setSaved(false);
  };
  return (
    <form
      className="plan-day"
      onSubmit={(e) => {
        e.preventDefault();
        if (window.confirm(tr("ยืนยันการเปลี่ยนแผนสำหรับเซสชันใหม่?")))
          void run(() => saveDay(day)).then((ok) => setSaved(ok));
      }}
    >
      <h2>{day.name}</h2>
      {day.exercises.map((t, i) => {
        const exercise = data.exercises.find((e) => e.id === t.exerciseId);
        return (
          <details className="edit-row" key={t.exerciseId}>
            <summary>
              {exercise?.name}
              <span>
                {t.sets} × {t.min}–{t.max}
              </span>
            </summary>
            <div className="grid-2">
              <NumberField
                label={tr("เซต")}
                value={Number.isNaN(t.sets) ? "" : t.sets}
                min={1}
                max={20}
                onChange={(v) => update(i, "sets", v)}
              />
              <NumberField
                label={tr("พัก (วินาที)")}
                value={Number.isNaN(t.rest) ? "" : t.rest}
                max={900}
                onChange={(v) => update(i, "rest", v)}
              />
              <NumberField
                label={
                  exercise?.modality === "hold"
                    ? tr("ค้างขั้นต่ำ (วิ)")
                    : tr("ครั้งขั้นต่ำ / ข้างถ้ามี")
                }
                value={Number.isNaN(t.min) ? "" : t.min}
                onChange={(v) => update(i, "min", v)}
              />
              <NumberField
                label={tr("สูงสุด")}
                value={Number.isNaN(t.max) ? "" : t.max}
                onChange={(v) => update(i, "max", v)}
              />
            </div>
            <div className="toolbar">
              <button
                type="button"
                aria-label={tr("เลื่อน {0} ขึ้น", exercise?.name)}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ChevronUp size={18} />
              </button>
              <button
                type="button"
                aria-label={tr("เลื่อน {0} ลง", exercise?.name)}
                disabled={i === day.exercises.length - 1}
                onClick={() => move(i, 1)}
              >
                <ChevronDown size={18} />
              </button>
              <button
                type="button"
                className="danger-text"
                onClick={() => {
                  setDay({
                    ...day,
                    exercises: day.exercises.filter((_, index) => index !== i),
                  });
                  setSaved(false);
                }}
              >
                <Trash2 size={16} />
                {tr("ลบท่า")}
              </button>
            </div>
          </details>
        );
      })}
      <div className="inline-form">
        <label>
          {tr("เพิ่มท่า")}
          <select value={add} onChange={(e) => setAdd(e.target.value)}>
            <option value="">{tr("เลือกท่า")}</option>
            {available.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="secondary"
          disabled={!add}
          onClick={() => {
            setDay({
              ...day,
              exercises: [
                ...day.exercises,
                { exerciseId: add, sets: 3, min: 5, max: 8, rest: 120 },
              ],
            });
            setAdd("");
            setSaved(false);
          }}
        >
          <Plus size={17} />
          {tr("เพิ่ม")}
        </button>
      </div>
      <button disabled={busy || !day.exercises.length} className="primary wide">
        {tr("ยืนยันการเปลี่ยนแผน")}
      </button>
      {saved && (
        <p role="status" className="success">
          {tr("บันทึกแผนแล้ว")}
        </p>
      )}
    </form>
  );
}
export function Library() {
  const { t: tr } = useLanguage();

  const { data } = useData();
  const [search, setSearch] = useState("");
  return (
    <>
      <Back />
      <Heading eyebrow="EXERCISE LIBRARY" title={tr("รู้จักทุกการเคลื่อนไหว")}>
        {tr("ใช้ช่วงที่ควบคุมได้ หยุดเมื่อเจ็บ")}
      </Heading>
      <label>
        {tr("ค้นหาท่า")}
        <input
          type="search"
          value={search}
          placeholder={tr("เช่น Push-up")}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {data.exercises
        .filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
        .map((ex) => (
          <details className="library-row" key={ex.id}>
            <summary>
              <span>
                {ex.name}
                <small>
                  {ex.category} ·{" "}
                  {ex.modality === "hold"
                    ? tr("วินาที")
                    : ex.perSide
                      ? tr("ครั้งต่อข้าง")
                      : tr("ครั้ง")}
                </small>
              </span>
            </summary>
            <p>{tr(ex.instructions)}</p>
            <p className="caption">
              {tr("อุปกรณ์: ")}
              {ex.equipment.join(", ") || tr("น้ำหนักตัว")}
            </p>
            <p className="caption">{tr(ex.precautions)}</p>
            <p className="caption">
              {tr("ปรับให้ง่าย: ")}
              {tr(ex.easier)} {tr(" · เมื่อพร้อม: ")}
              {tr(ex.harder)}
            </p>
          </details>
        ))}
    </>
  );
}
