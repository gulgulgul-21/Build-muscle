import { useLanguage } from "../../i18n/LanguageProvider";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { subWeeks, startOfWeek, addDays } from "date-fns";
import { ArrowUpRight, Plus } from "lucide-react";
import { useData } from "../../app/context";
import { Heading, Empty, NumberField } from "../../components/ui";
import { localDate } from "../../domain/model";
import { addRecord, addMeasurement } from "../../db/repository";
export function Progress() {
  const { t: tr } = useLanguage();

  const { data, run, busy } = useData();
  const [exerciseId, setExercise] = useState(
    data.exercises.find((e) => e.name === "Push-up")!.id,
  );
  const [tab, setTab] = useState<"records" | "weight">("records");
  const [value, setValue] = useState("");
  const [source, setSource] = useState<"test" | "baseline">("test");
  const [kg, setKg] = useState(String(data.profile[0].weight));
  const [waist, setWaist] = useState("");
  const [saved, setSaved] = useState("");
  const ex = data.exercises.find((e) => e.id === exerciseId)!;
  const records = data.personalRecords
    .filter((r) => r.exerciseId === exerciseId)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const recordPoints = new Map<string, number>();
  for (const r of records) {
    const date = localDate(new Date(r.occurredAt));
    recordPoints.set(date, Math.max(recordPoints.get(date) || 0, r.value));
  }
  const points = [...recordPoints].map(([date, value]) => ({ date, value }));
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const start = startOfWeek(subWeeks(new Date(), 3 - i), { weekStartsOn: 1 });
    const date = localDate(start);
    const end = localDate(addDays(start, 6));
    return {
      date,
      value: data.sessions.filter(
        (s) =>
          s.state === "completed" &&
          s.scheduledDate >= date &&
          s.scheduledDate <= end,
      ).length,
    };
  });
  const history = [...data.sessions]
    .filter((s) => s.state !== "active")
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return (
    <>
      <Heading eyebrow="YOUR PROGRESS" title={tr("มองเห็นการเติบโต")}>
        {tr("เปรียบเทียบกับตัวคุณเอง ครั้งละหนึ่งเซต")}
      </Heading>
      <div className="segmented">
        <button
          className={tab === "records" ? "selected" : ""}
          onClick={() => setTab("records")}
        >
          {tr("สถิติและการฝึก")}
        </button>
        <button
          className={tab === "weight" ? "selected" : ""}
          onClick={() => setTab("weight")}
        >
          {tr("น้ำหนักตัว")}
        </button>
      </div>
      {tab === "records" ? (
        <>
          <label>
            {tr("ท่าฝึก")}
            <select
              value={exerciseId}
              onChange={(e) => {
                setExercise(e.target.value);
                setValue("");
              }}
            >
              {data.exercises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <section className="section chart-section">
            <div className="section-title">
              <h2>{tr("สูงสุดต่อเซต")}</h2>
              <span className="muted">
                {ex.modality === "hold" ? tr("วินาที") : tr("ครั้ง")}
                {ex.perSide ? tr(" / ข้าง") : ""}
              </span>
            </div>
            {points.length ? (
              <>
                <div
                  className="chart"
                  role="img"
                  aria-label={tr("กราฟ {0} สูงสุดต่อเซต ตามวันที่", ex.name)}
                >
                  <ResponsiveContainer width="100%" height={210}>
                    <LineChart
                      data={points}
                      margin={{ top: 12, right: 16, bottom: 12, left: -24 }}
                    >
                      <CartesianGrid vertical={false} stroke="#eaeaea" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d) => String(d).slice(5)}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        allowDecimals={false}
                        domain={[0, "auto"]}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip />
                      <Line
                        type="linear"
                        dataKey="value"
                        name={
                          ex.modality === "hold"
                            ? tr("วินาที")
                            : tr("ครั้งต่อเซต")
                        }
                        stroke="#536c59"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <details>
                  <summary>{tr("ดูข้อมูลกราฟ")}</summary>
                  {points.map((p) => (
                    <p className="metric-line" key={p.date}>
                      <span>{p.date}</span>
                      <strong>{p.value}</strong>
                    </p>
                  ))}
                </details>
              </>
            ) : (
              <Empty>
                {tr("ยังไม่มีสถิติ บันทึกเซตแรกหรือทดสอบ max ด้านล่าง")}
              </Empty>
            )}
            <p className="caption">
              {tr(
                "สูงสุดของเซตเดี่ยวในแต่ละวัน รวมค่าเริ่มต้นและการทดสอบ ไม่รวมหลายเซตเข้าด้วยกัน",
              )}
            </p>
          </section>
          <details className="record-entry">
            <summary>
              <Plus size={16} />
              {tr("เพิ่มผลทดสอบ / ค่าเริ่มต้น")}
            </summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(() =>
                  addRecord({
                    exerciseId,
                    metric: ex.modality === "hold" ? "seconds" : "reps",
                    value: Number(value),
                    source,
                  }),
                ).then((ok) => {
                  if (ok) {
                    setSaved("บันทึกสถิติแล้ว");
                    setValue("");
                  }
                });
              }}
            >
              <NumberField
                label={
                  ex.modality === "hold"
                    ? tr("เวลาค้าง (วิ)")
                    : tr("ครั้งติดต่อกันในเซตเดียว")
                }
                value={value}
                onChange={setValue}
              />
              <label>
                {tr("ที่มา")}
                <select
                  value={source}
                  onChange={(e) =>
                    setSource(e.target.value as "test" | "baseline")
                  }
                >
                  <option value="test">{tr("ผลทดสอบเซตเดียว")}</option>
                  <option value="baseline">
                    {tr("ค่าเริ่มต้นที่บันทึกเอง")}
                  </option>
                </select>
              </label>
              <button className="secondary" disabled={busy}>
                {tr("บันทึกสถิติ")}
              </button>
              {saved && (
                <p className="success" role="status">
                  {tr(saved)}
                </p>
              )}
            </form>
          </details>
          <div className="record-list">
            {[...records]
              .reverse()
              .slice(0, 8)
              .map((r) => (
                <div className="metric-line" key={r.id}>
                  <span>
                    {localDate(new Date(r.occurredAt))}
                    <small>
                      {r.source === "baseline"
                        ? tr("ค่าเริ่มต้น")
                        : r.source === "test"
                          ? tr("ทดสอบ")
                          : tr("จากเซตที่บันทึก")}
                    </small>
                  </span>
                  <strong>
                    {r.value} {ex.modality === "hold" ? tr("วิ") : tr("ครั้ง")}
                  </strong>
                </div>
              ))}
          </div>
          <section className="section">
            <h2>{tr("การฝึก 4 สัปดาห์ล่าสุด")}</h2>
            <p className="caption">
              {tr(
                "แกน X: สัปดาห์เริ่มวันจันทร์ · แกน Y: เซสชันที่เสร็จตามวันที่กำหนด",
              )}
            </p>
            <div
              className="chart"
              role="img"
              aria-label={tr("เซสชันสำเร็จรายสัปดาห์")}
            >
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={weeks} margin={{ left: -24, right: 16 }}>
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => String(d).slice(5)}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="value"
                    name={tr("ครั้งที่ฝึกสำเร็จ")}
                    fill="#8b9b8d"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="section">
            <h2>{tr("น้ำหนักตัว (kg)")}</h2>
            {data.measurements.length ? (
              <>
                <div className="chart">
                  <ResponsiveContainer width="100%" height={210}>
                    <LineChart
                      data={[...data.measurements].sort((a, b) =>
                        a.date.localeCompare(b.date),
                      )}
                      margin={{ left: -16, right: 16 }}
                    >
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d) => String(d).slice(5)}
                      />
                      <YAxis domain={["auto", "auto"]} />
                      <Tooltip />
                      <Line
                        dataKey="kg"
                        name="kg"
                        stroke="#536c59"
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {data.measurements.map((m) => (
                  <div className="metric-line" key={m.id}>
                    <span>{m.date}</span>
                    <span>
                      {m.kg} kg {m.waist ? tr("· เอว {0} cm", m.waist) : ""}
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <Empty>{tr("ยังไม่มีการชั่งน้ำหนัก")}</Empty>
            )}
          </section>
          <form
            className="surface"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() =>
                addMeasurement(Number(kg), waist === "" ? null : Number(waist)),
              );
            }}
          >
            <div className="grid-2">
              <NumberField
                label={tr("น้ำหนัก (kg)")}
                min={1}
                max={500}
                step={0.1}
                value={kg}
                onChange={setKg}
              />
              <label>
                {tr("รอบเอว (cm, ไม่บังคับ)")}
                <input
                  type="number"
                  min={1}
                  max={300}
                  step={0.1}
                  value={waist}
                  onChange={(e) => setWaist(e.target.value)}
                />
              </label>
            </div>
            <button className="primary wide" disabled={busy}>
              {tr("บันทึกน้ำหนักวันนี้")}
            </button>
          </form>
        </>
      )}
      <section className="section">
        <div className="section-title">
          <h2>{tr("ประวัติการฝึก")}</h2>
          <span className="caption">
            {history.length} {tr(" ครั้งที่ฝึก")}
          </span>
        </div>
        {!history.length ? (
          <Empty>
            {tr("เริ่มฝึกครั้งแรก แล้วกลับมาดูพัฒนาการของคุณ")}
            <Link to="/workout">
              {tr("เลือกแผน ")}
              <ArrowUpRight size={15} />
            </Link>
          </Empty>
        ) : (
          history.map((s) => (
            <Link
              className="history-row"
              key={s.id}
              to={`/workout/summary/${s.id}`}
            >
              <div>
                <strong>{s.dayName}</strong>
                <small>
                  {s.scheduledDate} ·{" "}
                  {s.state === "abandoned" ? tr("ยกเลิก") : tr("สำเร็จ")} ·{" "}
                  {data.sets.filter((x) => x.sessionId === s.id).length}{" "}
                  {tr(" เซต")}
                </small>
              </div>
              <ArrowUpRight size={18} />
            </Link>
          ))
        )}
      </section>
    </>
  );
}
