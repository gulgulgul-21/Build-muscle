import { useLanguage } from "../../i18n/LanguageProvider";
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Minus,
  Plus,
  Check,
  ArrowRight,
  Timer,
  ShieldCheck,
} from "lucide-react";
import { useData } from "../../app/context";
import { Back, Heading, NumberField, Empty } from "../../components/ui";
import {
  closeSession,
  saveSet,
  correctSet,
  skipExercise,
  swapExercise,
  stopTimer,
  saveSessionNotes,
  logPain,
} from "../../db/repository";
import {
  progression,
  totals,
  type Session,
  type Target,
  type WorkoutSet,
} from "../../domain/model";
export function ActiveWorkout() {
  const { t: tr } = useLanguage();

  const { data, run, busy } = useData();
  const navigate = useNavigate();
  const session = data.sessions.find((s) => s.state === "active");
  const [selected, setSelected] = useState<string | null>(null);
  const [notes, setNotes] = useState(session?.notes || "");
  if (!session)
    return (
      <>
        <Back />
        <Heading
          eyebrow="READY WHEN YOU ARE"
          title={tr("พร้อมเริ่มเมื่อคุณพร้อม")}
        />
        <Empty>
          {tr("ยังไม่มีเซสชันที่กำลังฝึก")}
          <Link className="primary" to="/workout">
            {tr("เลือกแผนการฝึก")}
          </Link>
        </Empty>
      </>
    );
  const sets = data.sets.filter((s) => s.sessionId === session.id);
  const incomplete = session.snapshot.find(
    (t) =>
      !session.skipped.includes(t.exerciseId) &&
      sets.filter((s) => s.exerciseId === t.exerciseId).length < t.sets,
  );
  const target =
    session.snapshot.find((t) => t.exerciseId === selected) ||
    incomplete ||
    session.snapshot[0];
  const index = session.snapshot.indexOf(target);
  const exercise = data.exercises.find((e) => e.id === target.exerciseId)!;
  const done = sets.filter((s) => s.exerciseId === target.exerciseId);
  const ordinal = done.length + 1;
  const hasPain = data.painLogs.some(
    (p) => p.sessionId === session.id && p.intensity > 0,
  );
  const elbow = data.painLogs.some(
    (p) => p.sessionId === session.id && p.location === "elbow",
  );
  const blocked = elbow && ["Dip", "Negative Pull-up"].includes(exercise.name);
  const skipped = session.skipped.includes(exercise.id);
  const previous = data.sets
    .filter(
      (s) =>
        s.exerciseId === exercise.id &&
        s.sessionId !== session.id &&
        data.sessions.some(
          (x) => x.id === s.sessionId && x.state === "completed",
        ),
    )
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const previousSession = previous[0]?.sessionId;
  const previousValues = previous
    .filter((s) => s.sessionId === previousSession)
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((s) => s.value)
    .join(" / ");
  return (
    <article className="active-workout">
      <Back />
      <div className="session-top">
        <p className="eyebrow">{session.dayName}</p>
        <span className="caption">{tr("บันทึกอัตโนมัติ")}</span>
      </div>
      <div className="thin-progress">
        <span
          style={{
            width: `${(sets.length / session.snapshot.reduce((a, t) => a + t.sets, 0)) * 100}%`,
          }}
        />
      </div>
      <div className="session-heading">
        <span className="eyebrow">
          {tr("ท่า ")}
          {index + 1} / {session.snapshot.length}
        </span>
        <h1>{exercise.name}</h1>
        <p className="muted">
          {tr("เป้า ")}
          {target.sets} × {target.min}–{target.max}{" "}
          {exercise.modality === "hold"
            ? tr("วินาที")
            : exercise.perSide
              ? tr("ครั้ง / ข้าง")
              : tr("ครั้ง")}{" "}
          {tr("· พัก ")}
          {target.rest} {tr(" วิ")}
        </p>
        <p className="caption">
          {tr("ครั้งก่อน: ")}
          {previousValues || tr("ยังไม่มีข้อมูล")}{" "}
          {previousValues &&
            (exercise.modality === "hold" ? tr("วิ") : tr("ครั้ง"))}
        </p>
      </div>
      <details className="instruction">
        <summary>{tr("วิธีฝึกและข้อควรระวัง")}</summary>
        <p>{tr(exercise.instructions)}</p>
        <p className="caption">{tr(exercise.precautions)}</p>
        {exercise.equipment.some(
          (e) => !data.profile[0].equipment.includes(e),
        ) && (
          <p className="warning">
            {tr("ตรวจสอบอุปกรณ์ก่อนฝึก: ")}
            {exercise.equipment.join(", ")}{" "}
            {tr(" · ถ้าไม่มีฐานที่มั่นคงให้ข้ามท่า")}
          </p>
        )}
      </details>
      {hasPain && (
        <div role="alert" className="warning">
          <ShieldCheck size={18} />
          <span>
            {tr(progression(true))}
            {blocked && (
              <strong>
                {" "}
                {tr(" หยุด ")}
                {exercise.name} {tr(" เมื่อมีอาการเจ็บศอก")}
              </strong>
            )}
          </span>
        </div>
      )}
      {ordinal <= target.sets && !skipped && !blocked ? (
        <SetLogger
          key={`${session.id}/${target.exerciseId}/${ordinal}`}
          session={session}
          target={target}
          ordinal={ordinal}
        />
      ) : (
        <div className="completed-exercise">
          <Check size={22} />
          <strong>
            {skipped
              ? tr("ข้ามท่านี้แล้ว")
              : blocked
                ? tr("พักท่านี้เพื่อความปลอดภัย")
                : tr("บันทึกครบแล้ว")}
          </strong>
          {incomplete && incomplete.exerciseId !== target.exerciseId && (
            <button
              className="primary"
              onClick={() => setSelected(incomplete.exerciseId)}
            >
              {tr("ท่าถัดไป")}
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      )}
      <RestTimer session={session} />
      <div className="toolbar workout-tools">
        <button
          disabled={busy || skipped}
          onClick={() =>
            void run(async () => {
              await skipExercise(session.id, exercise.id);
              setSelected(null);
            })
          }
        >
          {tr("ข้ามท่านี้")}
        </button>
        <SwapControl session={session} target={target} />
      </div>
      <PainForm key={exercise.id} session={session} exerciseId={exercise.id} />
      <details className="all-sets">
        <summary>
          {tr("ดู / แก้ไขเซตทั้งหมด (")}
          {sets.length})
        </summary>
        {session.snapshot.map((t) => (
          <div key={t.exerciseId}>
            <button
              className="exercise-select"
              onClick={() => setSelected(t.exerciseId)}
            >
              {data.exercises.find((e) => e.id === t.exerciseId)?.name}
              <span>
                {sets.filter((s) => s.exerciseId === t.exerciseId).length}/
                {t.sets}
                {session.skipped.includes(t.exerciseId) ? tr(" · ข้าม") : ""}
              </span>
            </button>
            {sets
              .filter((s) => s.exerciseId === t.exerciseId)
              .sort((a, b) => a.ordinal - b.ordinal)
              .map((s) => (
                <SavedSet key={s.id} set={s} />
              ))}
          </div>
        ))}
      </details>
      <section className="section">
        <label>
          {tr("โน้ตหลังฝึก")}
          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              void run(() => saveSessionNotes(session.id, e.target.value));
            }}
            placeholder={tr("วันนี้รู้สึกอย่างไรบ้าง")}
          />
        </label>
        <button
          className="primary wide"
          disabled={busy}
          onClick={() => {
            if (
              sets.length < session.snapshot.reduce((a, t) => a + t.sets, 0) &&
              !window.confirm(
                tr("ยังมีเซตที่ไม่ได้บันทึก ต้องการจบการฝึกตอนนี้?"),
              )
            )
              return;
            void run(async () => {
              await closeSession(session.id, "completed", notes);
              navigate(`/workout/summary/${session.id}`);
            });
          }}
        >
          {tr("จบการฝึก ")}
          <Check size={18} />
        </button>
        <button
          className="text-button danger-text wide"
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                tr(
                  "ยกเลิกเซสชันนี้? เซตที่บันทึกไว้ยังอยู่ในประวัติ แต่ไม่นับเป็นฝึกสำเร็จ",
                ),
              )
            )
              void run(async () => {
                await closeSession(session.id, "abandoned", notes);
                navigate("/workout");
              });
          }}
        >
          {tr("ยกเลิกเซสชัน")}
        </button>
      </section>
    </article>
  );
}
export function SetLogger({
  session,
  target,
  ordinal,
}: {
  session: Session;
  target: Target;
  ordinal: number;
}) {
  const { t: tr } = useLanguage();

  const { data, run, busy } = useData();
  const exercise = data.exercises.find((e) => e.id === target.exerciseId)!;
  const [value, setValue] = useState(String(target.min));
  const [rir, setRir] = useState("");
  const [weight, setWeight] = useState("5");
  const pending = useRef(false);
  return (
    <form
      className="set-logger"
      onSubmit={(e) => {
        e.preventDefault();
        if (pending.current) return;
        pending.current = true;
        void run(() =>
          saveSet({
            sessionId: session.id,
            exerciseId: target.exerciseId,
            ordinal,
            value: Number(value),
            weight: exercise.modality === "weighted" ? Number(weight) : 0,
            rir: rir === "" ? null : Number(rir),
            modified: false,
          }),
        ).finally(() => {
          pending.current = false;
        });
      }}
    >
      <div className="set-label">
        <span>
          {tr("เซตที่ ")}
          {ordinal}
        </span>
        <span className="muted">
          {tr("จาก ")}
          {target.sets} {tr(" เซต")}
        </span>
      </div>
      <div className="number-picker">
        <button
          type="button"
          aria-label={tr("ลดจำนวน")}
          disabled={value === "" || Number(value) <= 0}
          onClick={() => setValue(String(Math.max(0, Number(value) - 1)))}
        >
          <Minus size={22} />
        </button>
        <label>
          <input
            aria-label={
              exercise.modality === "hold" ? tr("เวลาค้าง") : tr("จำนวนครั้ง")
            }
            type="number"
            min={0}
            max={9999}
            step={1}
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <span>
            {exercise.modality === "hold"
              ? tr("วินาที")
              : exercise.perSide
                ? tr("ครั้งต่อข้าง")
                : tr("ครั้ง")}
          </span>
        </label>
        <button
          type="button"
          aria-label={tr("เพิ่มจำนวน")}
          disabled={Number(value) >= 9999}
          onClick={() => setValue(String(Number(value) + 1))}
        >
          <Plus size={22} />
        </button>
      </div>
      <div className="logger-options">
        <label>
          RIR <span className="caption">{tr("เหลือแรง (ไม่บังคับ)")}</span>
          <select value={rir} onChange={(e) => setRir(e.target.value)}>
            <option value="">{tr("ไม่ระบุ")}</option>
            {Array.from({ length: 11 }, (_, i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </label>
        {exercise.modality === "weighted" && (
          <NumberField
            label={tr("น้ำหนักภายนอกรวม (kg)")}
            value={weight}
            max={1000}
            step={0.5}
            onChange={setWeight}
          />
        )}
      </div>
      <button
        className="primary wide log-button"
        disabled={busy || value === ""}
      >
        <Check size={21} />
        {tr("บันทึกเซต")}
      </button>
      <p className="caption center">{tr("เซตจะถูกบันทึกในอุปกรณ์ทันที")}</p>
    </form>
  );
}
function RestTimer({ session }: { session: Session }) {
  const { t: tr } = useLanguage();

  const { data, run } = useData();
  const [time, setTime] = useState(Date.now());
  const notified = useRef(false);
  useEffect(() => {
    notified.current = false;
    const interval = setInterval(() => setTime(Date.now()), 500);
    return () => clearInterval(interval);
  }, [session.restEnd]);
  const remaining = session.restEnd
    ? Math.max(0, Math.ceil((session.restEnd - time) / 1000))
    : 0;
  useEffect(() => {
    if (session.restEnd && remaining === 0 && !notified.current) {
      notified.current = true;
      if (data.settings[0].vibration && typeof navigator.vibrate === "function")
        navigator.vibrate(120);
    }
  }, [remaining, session.restEnd, data.settings]);
  if (!session.restEnd) return null;
  return (
    <div className="rest-timer" role="status">
      <Timer size={22} />
      <div>
        <span>{remaining ? tr("พักระหว่างเซต") : tr("พักครบแล้ว")}</span>
        <strong>
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
        </strong>
      </div>
      <button onClick={() => void run(() => stopTimer(session.id))}>
        {tr("ปิดเวลา")}
      </button>
    </div>
  );
}
function SwapControl({
  session,
  target,
}: {
  session: Session;
  target: Target;
}) {
  const { t: tr } = useLanguage();

  const { data, run, busy } = useData();
  const exercise = data.exercises.find((e) => e.id === target.exerciseId)!;
  const [to, setTo] = useState("");
  const available = data.exercises.filter(
    (e) =>
      !data.profile[0].excluded.includes(e.name) &&
      !session.snapshot.some((t) => t.exerciseId === e.id),
  );
  return (
    <details className="swap">
      <summary>{tr("เปลี่ยนท่า")}</summary>
      <p className="caption">
        {tr("แนะนำ ")}
        {tr(exercise.easier)} {tr(" เฉพาะเมื่อไม่เจ็บ ตรวจสอบอุปกรณ์ก่อนเลือก")}
      </p>
      <label>
        {tr("ท่าทดแทน")}
        <select value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">{tr("เลือกท่า")}</option>
          {available.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className="secondary"
        disabled={!to || busy}
        onClick={() =>
          void run(() => swapExercise(session.id, target.exerciseId, to))
        }
      >
        {tr("ยืนยันเปลี่ยนท่า")}
      </button>
    </details>
  );
}
function SavedSet({ set }: { set: WorkoutSet }) {
  const { t: tr } = useLanguage();

  const { run, busy } = useData();
  const [value, setValue] = useState(String(set.value));
  const [weight, setWeight] = useState(String(set.weight));
  const [rir, setRir] = useState(set.rir === null ? "" : String(set.rir));
  return (
    <form
      className="saved-set"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() =>
          correctSet({
            ...set,
            value: Number(value),
            weight: Number(weight),
            rir: rir === "" ? null : Number(rir),
          }),
        );
      }}
    >
      <span>#{set.ordinal}</span>
      <label>
        {tr("ครั้ง / วิ")}
        <input
          type="number"
          aria-label={tr("แก้ไขเซต {0}", set.ordinal)}
          min={0}
          max={9999}
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <label>
        kg
        <input
          type="number"
          min={0}
          max={1000}
          step={0.5}
          required
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
      </label>
      <label>
        RIR
        <input
          type="number"
          min={0}
          max={10}
          value={rir}
          onChange={(e) => setRir(e.target.value)}
        />
      </label>
      <button className="secondary" disabled={busy}>
        {tr("บันทึก")}
      </button>
    </form>
  );
}
export function PainForm({
  session,
  exerciseId,
}: {
  session: Session;
  exerciseId: string;
}) {
  const { t: tr } = useLanguage();

  const { run, busy } = useData();
  const [location, setLocation] = useState("none");
  const [intensity, setIntensity] = useState("3");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <details className="pain-check">
      <summary>
        <ShieldCheck size={17} />
        {tr("เช็กอาการระหว่าง / หลังฝึก")}
      </summary>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (location === "none") {
            setSaved(true);
            return;
          }
          void run(() =>
            logPain({
              sessionId: session.id,
              exerciseId,
              location: location as
                "elbow" | "lower back" | "shoulder" | "other",
              intensity: Number(intensity),
              note,
            }),
          ).then((ok) => setSaved(ok));
        }}
      >
        <label>
          {tr("บริเวณ")}
          <select
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setSaved(false);
            }}
          >
            <option value="none">{tr("ไม่เจ็บ")}</option>
            <option value="elbow">{tr("ศอก")}</option>
            <option value="lower back">{tr("หลังล่าง")}</option>
            <option value="shoulder">{tr("ไหล่")}</option>
            <option value="other">{tr("อื่น ๆ")}</option>
          </select>
        </label>
        {location !== "none" && (
          <>
            <NumberField
              label={tr("ความรุนแรง 1–10")}
              min={1}
              max={10}
              value={intensity}
              onChange={setIntensity}
            />
            <label>
              {tr("รายละเอียด")}
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <div className="warning">
              {tr(
                "หยุดท่าที่กระตุ้นอาการ ไม่เพิ่มความหนัก · Pull-up: ช่วยดึงหรือพัก · Dip: ลดระยะหรือ Incline Push-up เมื่อไม่เจ็บ · Hollow Hold: Dead Bug · ขา: Supported Squat",
              )}
              <br />
              {tr(
                "หากอาการต่อเนื่อง ขยับข้อได้ไม่เต็มที่ ปวดร้าว ชา หรืออ่อนแรง ควรพบผู้เชี่ยวชาญ",
              )}
            </div>
          </>
        )}
        <button className="secondary" disabled={busy}>
          {tr("บันทึกอาการ")}
        </button>
        {saved && (
          <p className="success" role="status">
            {tr("บันทึกแล้ว")}
          </p>
        )}
      </form>
    </details>
  );
}
export function Summary() {
  const { t: tr } = useLanguage();

  const { id } = useParams();
  const { data } = useData();
  const session = data.sessions.find((s) => s.id === id);
  if (!session)
    return (
      <Empty>
        {tr("ไม่พบเซสชัน")}
        <Link to="/progress">{tr("กลับประวัติ")}</Link>
      </Empty>
    );
  const sets = data.sets.filter((s) => s.sessionId === session.id);
  const metrics = totals(sets, data.exercises);
  const minutes = Math.max(
    0,
    Math.floor(
      (new Date(session.completedAt || Date.now()).getTime() -
        new Date(session.startedAt).getTime()) /
        60000,
    ),
  );
  const previous = data.personalRecords.filter(
    (r) =>
      r.occurredAt <= session.startedAt &&
      !sets.some((s) => s.id === r.sourceId),
  );
  const events = [...new Set(sets.map((s) => s.exerciseId))].filter(
    (ex) =>
      Math.max(...sets.filter((s) => s.exerciseId === ex).map((s) => s.value)) >
      Math.max(
        0,
        ...previous.filter((r) => r.exerciseId === ex).map((r) => r.value),
      ),
  );
  return (
    <>
      <Back to="/progress" />
      <Heading
        eyebrow={
          session.state === "abandoned"
            ? "SESSION ABANDONED"
            : "SESSION COMPLETE"
        }
        title={
          session.state === "abandoned"
            ? tr("บันทึกเซสชันที่ยกเลิก")
            : tr("อีกหนึ่งครั้งที่ได้ฝึก")
        }
      >
        {session.dayName} · {session.scheduledDate}
      </Heading>
      <div className="summary-metrics">
        <div>
          <strong>{minutes}</strong>
          <span>{tr("นาที")}</span>
        </div>
        <div>
          <strong>
            {sets.length}
            <small> / {session.snapshot.reduce((a, t) => a + t.sets, 0)}</small>
          </strong>
          <span>{tr("เซตที่บันทึก")}</span>
        </div>
      </div>
      <div className="metric-line">
        <span>{tr("จำนวนครั้งรวม (นับทั้งสองข้าง)")}</span>
        <strong>
          {metrics.reps} {tr(" ครั้ง")}
        </strong>
      </div>
      <div className="metric-line">
        <span>{tr("เวลาค้างรวม")}</span>
        <strong>
          {metrics.seconds} {tr(" วิ")}
        </strong>
      </div>
      <div className="metric-line">
        <span>{tr("ปริมาณจากน้ำหนักภายนอก")}</span>
        <strong>{metrics.externalKg} kg·reps</strong>
      </div>
      {events.length > 0 && (
        <section className="section">
          <h2>{tr("สถิติใหม่ต่อเซต")}</h2>
          {events.map((ex) => (
            <p key={ex}>
              {data.exercises.find((e) => e.id === ex)?.name} ·{" "}
              {Math.max(
                ...sets.filter((s) => s.exerciseId === ex).map((s) => s.value),
              )}
            </p>
          ))}
        </section>
      )}
      <section className="section">
        <h2>{tr("รายละเอียดการฝึก")}</h2>
        {session.snapshot.map((t) => (
          <div className="exercise-row" key={t.exerciseId}>
            <span>
              {data.exercises.find((e) => e.id === t.exerciseId)?.name}
              <small className="caption">
                {" "}
                {tr("เป้า ")}
                {t.sets} × {t.min}–{t.max}
              </small>
            </span>
            <span>
              {sets
                .filter((s) => s.exerciseId === t.exerciseId)
                .sort((a, b) => a.ordinal - b.ordinal)
                .map((s) => s.value)
                .join(" / ") || "—"}
            </span>
          </div>
        ))}
      </section>
      {session.notes && <p className="quiet-note">{session.notes}</p>}
      <PainForm session={session} exerciseId={session.snapshot[0].exerciseId} />
      {data.painLogs
        .filter((p) => p.sessionId === session.id)
        .map((p) => (
          <p className="warning" key={p.id}>
            {p.location} · {p.intensity}/10 · {p.note}
          </p>
        ))}
      <Link className="primary wide" to="/">
        {tr("เสร็จสิ้น")}
        <Check size={18} />
      </Link>
    </>
  );
}
