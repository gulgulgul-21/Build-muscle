import { useLanguage } from "../../i18n/LanguageProvider";
import { useState } from "react";
import { Download, Upload, LockKeyhole, Database, Check } from "lucide-react";
import { useData } from "../../app/context";
import { Heading, NumberField, weekdayNames } from "../../components/ui";
import {
  saveProfile,
  saveSettings,
  exportBackup,
  validateBackup,
  importBackup,
  download,
  historyCsv,
  resetData,
  updateBaseline,
} from "../../db/repository";
import { localDate, type Backup } from "../../domain/model";
import { LanguagePicker } from "../../components/LanguagePicker";
function BaselineSettings() {
  const { t: tr } = useLanguage();

  const { data, run, busy } = useData();
  return (
    <section className="section">
      <h2>{tr("ค่าเริ่มต้น · สูงสุดในเซตเดียว")}</h2>
      <p className="caption">
        {tr("แก้ไขค่าตั้งต้นได้ สถิติจากการฝึกยังเก็บแยกตามที่มา")}
      </p>
      {["Push-up", "Pull-up", "Dip"].map((name) => {
        const exercise = data.exercises.find((e) => e.name === name)!;
        const baseline = data.personalRecords.find(
          (r) => r.exerciseId === exercise.id && r.source === "baseline",
        );
        return (
          <BaselineRow
            key={exercise.id}
            name={name}
            value={baseline?.value || 0}
            busy={busy}
            save={(value) => run(() => updateBaseline(exercise.id, value))}
          />
        );
      })}
    </section>
  );
}
function BaselineRow({
  name,
  value,
  busy,
  save,
}: {
  name: string;
  value: number;
  busy: boolean;
  save: (value: number) => Promise<boolean>;
}) {
  const { t: tr } = useLanguage();

  const [count, setCount] = useState(String(value));
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save(Number(count)).then(setSaved);
      }}
    >
      <NumberField
        label={tr("{0} (ครั้ง)", name)}
        value={count}
        onChange={(v) => {
          setCount(v);
          setSaved(false);
        }}
      />
      <button className="secondary" disabled={busy}>
        {saved ? tr("บันทึกแล้ว") : tr("บันทึก")}
      </button>
    </form>
  );
}
export function Settings() {
  const { t: tr, intlLocale } = useLanguage();

  const { data, run, busy } = useData();
  const [profile, setProfile] = useState(structuredClone(data.profile[0]));
  const [saved, setSaved] = useState(false);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [message, setMessage] = useState("");
  const settings = data.settings[0];
  const exportJson = () =>
    void run(async () => {
      const b = await exportBackup();
      download(`form-backup-${localDate()}.json`, JSON.stringify(b, null, 2));
      await saveSettings({ ...settings, lastBackup: new Date().toISOString() });
      setMessage("ดาวน์โหลดไฟล์สำรองแล้ว กรุณาเก็บไว้ในที่ปลอดภัย");
    });
  return (
    <>
      <Heading eyebrow="YOUR SPACE" title={tr("ตั้งค่า")}>
        {tr("ปรับพื้นที่ฝึกให้เหมาะกับคุณ")}
      </Heading>
      <div className="privacy-note">
        <LockKeyhole size={20} />
        <p>
          {tr("ข้อมูลอยู่ในเบราว์เซอร์นี้เท่านั้น")}
          <span>
            {tr(
              "ไม่ซิงก์ข้ามอุปกรณ์ การล้างข้อมูลเบราว์เซอร์อาจลบประวัติทั้งหมด สำรองไฟล์เป็นระยะ",
            )}
          </span>
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => saveProfile(profile)).then((ok) => setSaved(ok));
        }}
      >
        <section className="section">
          <h2>{tr("โปรไฟล์")}</h2>
          <div className="grid-2">
            <NumberField
              label={tr("น้ำหนัก (kg)")}
              min={1}
              max={500}
              step={0.1}
              value={Number.isNaN(profile.weight) ? "" : profile.weight}
              onChange={(v) => {
                setProfile({ ...profile, weight: v === "" ? NaN : Number(v) });
                setSaved(false);
              }}
            />
            <NumberField
              label={tr("ส่วนสูง (cm)")}
              min={1}
              max={300}
              step={0.1}
              value={Number.isNaN(profile.height) ? "" : profile.height}
              onChange={(v) => {
                setProfile({ ...profile, height: v === "" ? NaN : Number(v) });
                setSaved(false);
              }}
            />
          </div>
          <label>
            {tr("เป้าหมาย")}
            <input
              value={profile.goals}
              required
              onChange={(e) => {
                setProfile({ ...profile, goals: e.target.value });
                setSaved(false);
              }}
            />
          </label>
          <label>
            {tr("อุปกรณ์ (คั่นด้วยเครื่องหมายจุลภาค)")}
            <input
              value={profile.equipment.join(",")}
              onChange={(e) => {
                setProfile({
                  ...profile,
                  equipment: e.target.value.split(","),
                });
                setSaved(false);
              }}
            />
          </label>
          <p className="caption">
            {tr(
              "Dumbbells = 2 × 5 kg เริ่มต้น · เปลี่ยนน้ำหนักที่ใช้จริงในหน้าบันทึกเซต",
            )}
            <br />
            {tr(
              "Stable support ต้องเป็นฐานที่มั่นคง ไม่สมมติว่า dip bars ใช้ดึงแนวนอนได้",
            )}
          </p>
          <label>
            {tr("ท่าที่ไม่ต้องการใช้ (คั่นด้วยจุลภาค)")}
            <input
              value={profile.excluded.join(",")}
              onChange={(e) => {
                setProfile({ ...profile, excluded: e.target.value.split(",") });
                setSaved(false);
              }}
            />
          </label>
          <div className="grid-3">
            {["A", "B", "C"].map((letter, i) => (
              <label key={letter}>
                {tr("วันฝึก ")}
                {letter}
                <select
                  value={profile.trainingDays[i]}
                  onChange={(e) => {
                    setProfile({
                      ...profile,
                      trainingDays: profile.trainingDays.map((d, index) =>
                        index === i ? Number(e.target.value) : d,
                      ),
                    });
                    setSaved(false);
                  }}
                >
                  {weekdayNames.map((day, index) => (
                    <option key={day} value={index}>
                      {tr(day)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button className="primary wide" disabled={busy}>
            {tr("บันทึกโปรไฟล์")}
          </button>
          {saved && (
            <p className="success" role="status">
              <Check size={15} />
              {tr("บันทึกแล้ว")}
            </p>
          )}
        </section>
      </form>
      <BaselineSettings />
      <section className="section">
        <h2>ภาษา / Language</h2>
        <LanguagePicker />
      </section>
      <section className="section">
        <h2>{tr("การใช้งาน")}</h2>
        <label className="toggle">
          {tr("จับเวลาพักอัตโนมัติ")}
          <input
            type="checkbox"
            checked={settings.timer}
            onChange={(e) =>
              void run(() =>
                saveSettings({ ...settings, timer: e.target.checked }),
              )
            }
          />
        </label>
        <label className="toggle">
          {tr("สั่นเมื่อพักครบ (หากอุปกรณ์รองรับ)")}
          <input
            type="checkbox"
            checked={settings.vibration}
            onChange={(e) =>
              void run(() =>
                saveSettings({ ...settings, vibration: e.target.checked }),
              )
            }
          />
        </label>
        <p className="caption">
          {tr(
            "ธีมสว่าง · หน่วยเมตริก · ไม่มีการแจ้งเตือนเบื้องหลังที่รับประกัน",
          )}
          <br />
          {tr(
            "ติดตั้งแอปจากเมนูเบราว์เซอร์ → เพิ่มลงในหน้าจอหลัก / ติดตั้งแอป รอข้อความพร้อมใช้งานออฟไลน์ก่อนใช้โดยไม่มีอินเทอร์เน็ต",
          )}
        </p>
      </section>
      <section className="section">
        <div className="section-title">
          <h2>{tr("สำรองและย้ายข้อมูล")}</h2>
          <Database size={18} />
        </div>
        <p className="muted">
          {tr("ส่งออกไฟล์ แล้วนำเข้าบนอุปกรณ์ใหม่ด้วยตัวคุณเอง")}
        </p>
        <p className="caption">
          {tr("สำรองล่าสุด:")}{" "}
          {settings.lastBackup
            ? new Date(settings.lastBackup).toLocaleString(intlLocale)
            : tr("ยังไม่เคยสำรอง")}
        </p>
        <div className="backup-actions">
          <button className="secondary" disabled={busy} onClick={exportJson}>
            <Download size={17} />
            {tr("สำรอง JSON")}
          </button>
          <button
            className="secondary"
            onClick={() =>
              download(
                `form-history-${localDate()}.csv`,
                historyCsv(data),
                "text/csv;charset=utf-8",
              )
            }
          >
            <Download size={17} />
            {tr("ส่งออก CSV")}
          </button>
        </div>
        <label className="file-label">
          <Upload size={18} />
          {tr("เลือกไฟล์สำรอง JSON")}
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setBackup(null);
              if (file)
                void run(async () => {
                  if (file.size > 20 * 1024 * 1024)
                    throw new Error(tr("ไฟล์ใหญ่เกิน 20 MB"));
                  setBackup(
                    validateBackup(
                      JSON.parse((await file.text()).replace(/^\uFEFF/, "")),
                    ),
                  );
                });
              e.target.value = "";
            }}
          />
        </label>
        {backup && (
          <div className="import-preview">
            <h3>{tr("ตรวจสอบก่อนนำเข้า")}</h3>
            <p>
              {backup.data.sessions.length} {tr(" เซสชัน · ")}
              {backup.data.sets.length} {tr("เซต · ")}
              {backup.data.personalRecords.length} {tr(" สถิติ")}
            </p>
            <p className="caption">
              {tr("ส่งออก ")}
              {new Date(backup.exportedAt).toLocaleString(intlLocale)}
            </p>
            <label>
              {tr("วิธีนำเข้า")}
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as "merge" | "replace")}
              >
                <option value="merge">
                  {tr("รวมข้อมูล — ID เดียวกันใช้รายการที่แก้ไขล่าสุด")}
                </option>
                <option value="replace">
                  {tr("แทนที่ — ลบข้อมูลเดิมทั้งหมด")}
                </option>
              </select>
            </label>
            <p className="caption">
              {mode === "merge"
                ? tr(
                    "รายการคนละ ID จะเก็บทั้งคู่ หากโปรไฟล์หรือเซสชันที่ยังฝึกขัดกัน ระบบจะยกเลิกทั้งรายการ ให้ใช้แทนที่หลังสำรอง",
                  )
                : tr(
                    "ข้อมูลในเบราว์เซอร์จะถูกแทนที่ทั้งหมด ควรสำรองไฟล์ปัจจุบันก่อน",
                  )}
            </p>
            <button
              className="primary wide"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    mode === "replace"
                      ? tr("ยืนยันแทนที่ข้อมูลทั้งหมดด้วยไฟล์นี้?")
                      : tr("ยืนยันรวมข้อมูลจากไฟล์นี้?"),
                  )
                )
                  void run(() => importBackup(backup, mode)).then((ok) => {
                    if (ok) {
                      setBackup(null);
                      setMessage("นำเข้าข้อมูลสำเร็จ");
                    }
                  });
              }}
            >
              {tr("ยืนยันนำเข้า")}
            </button>
          </div>
        )}
        {message && (
          <p role="status" className="success">
            {tr(message)}
          </p>
        )}
      </section>
      <section className="section">
        <h2>{tr("ความเป็นส่วนตัว")}</h2>
        <p className="muted">
          {tr(
            "ไม่มีบัญชี ไม่มีเซิร์ฟเวอร์ข้อมูล ไม่มีตัวติดตาม หน้าเว็บ GitHub Pages เป็นสาธารณะ แต่ประวัติอยู่ในอุปกรณ์นี้ ผู้ที่ใช้เบราว์เซอร์เดียวกันอาจมองเห็นข้อมูลได้",
          )}
        </p>
        <p className="caption">
          {tr(
            "ไฟล์สำรองเป็นข้อมูลส่วนตัว ไม่เข้ารหัส เก็บในที่ปลอดภัย แอปไม่อัปโหลดให้อัตโนมัติ",
          )}
        </p>
        <button
          className="danger-button"
          disabled={busy}
          onClick={() => {
            if (
              window.confirm(
                tr(
                  "ล้างประวัติและตั้งค่าใหม่ทั้งหมด? สำรองข้อมูลก่อนดำเนินการ",
                ),
              ) &&
              window.prompt(tr("พิมพ์ RESET เพื่อยืนยัน")) === "RESET"
            )
              void run(resetData).then((ok) => {
                if (ok) location.reload();
              });
          }}
        >
          {tr("ล้างข้อมูลและเริ่มใหม่")}
        </button>
      </section>
    </>
  );
}
