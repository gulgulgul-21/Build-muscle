import { useState } from "react";
import { useSync } from "./SyncProvider";
import { supabase } from "./client";
import { useLanguage } from "../../i18n/LanguageProvider";
export function SyncSettings() {
  const { t: tr, intlLocale } = useLanguage();
  const sync = useSync();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const labels = {
    signedOut: "ยังไม่ได้เข้าสู่ระบบ",
    syncing: "กำลังซิงก์…",
    synced: "ซิงก์แล้ว",
    offline: "ออฟไลน์ · จะซิงก์เมื่อเชื่อมต่อ",
    setup: "เลือกข้อมูลเริ่มต้น",
    conflict: "พบข้อมูลขัดแย้ง",
    error: "รอซิงก์อีกครั้ง",
  };
  async function action(fn: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch {
      setMessage("ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="section" id="sync">
      <h2>{tr("ซิงก์ระหว่างอุปกรณ์")}</h2>
      <p className="muted">
        {tr(
          "เข้าสู่ระบบด้วยอีเมลเดียวกันบนมือถือและคอม ข้อมูลจะซิงก์อัตโนมัติเมื่อเปิดแอปและมีอินเทอร์เน็ต",
        )}
      </p>
      <p role="status">{tr(labels[sync.state])}</p>
      {!sync.user ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action(async () => {
              const { error } = await supabase.auth.signInWithOtp({
                email: email.trim(),
                options: {
                  emailRedirectTo:
                    "https://gulgulgul-21.github.io/Build-muscle/",
                },
              });
              if (error) throw error;
              setMessage(
                "ส่งลิงก์เข้าสู่ระบบแล้ว เปิดอีเมลบนอุปกรณ์ที่ต้องการเชื่อมต่อ",
              );
            });
          }}
        >
          <label>
            {tr("อีเมล")}
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button className="primary" disabled={busy || !navigator.onLine}>
            {tr("ส่งลิงก์เข้าสู่ระบบ")}
          </button>
          <p className="caption">
            {tr(
              "บริการส่งอีเมลเริ่มต้นรองรับอีเมลสมาชิกองค์กร Supabase เท่านั้น หากใช้อีเมลอื่นต้องตั้งค่า SMTP ก่อน",
            )}
          </p>
        </form>
      ) : (
        <>
          <p>{sync.user.email}</p>
          <p className="caption">
            {tr("ซิงก์ล่าสุด:")}{" "}
            {sync.lastSynced
              ? new Date(sync.lastSynced).toLocaleString(intlLocale)
              : tr("ยังไม่เคยซิงก์")}
          </p>
          {(sync.state === "setup" || sync.state === "conflict") && (
            <div className="import-preview">
              <p>
                {tr(
                  sync.state === "conflict"
                    ? "แก้ข้อมูลเดียวกันจากสองอุปกรณ์ ระบบหยุดซิงก์เพื่อไม่ให้ข้อมูลทับกัน"
                    : "อุปกรณ์ใหม่ต้องเลือกข้อมูลที่จะใช้ก่อน ข้อมูลที่ไม่ได้เลือกจะไม่ถูกรวมอัตโนมัติ",
                )}
              </p>
              <p className="caption">
                {tr(
                  "ระบบจะดาวน์โหลดไฟล์สำรองทั้งสองฝั่งก่อนแทนที่ โปรดเก็บไฟล์ไว้ หากมีประวัติคนละชุดให้สำรองแล้วนำเข้าภายหลัง",
                )}
              </p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      tr("ใช้ข้อมูลอุปกรณ์นี้แทนข้อมูลคลาวด์และอุปกรณ์อื่น?"),
                    )
                  )
                    void action(() => sync.choose("local"));
                }}
              >
                {tr("ใช้ข้อมูลอุปกรณ์นี้บนทุกอุปกรณ์")}
              </button>
              {(sync.pending || sync.state === "conflict") && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        tr("แทนที่ข้อมูลในอุปกรณ์นี้ด้วยข้อมูลคลาวด์?"),
                      )
                    )
                      void action(() => sync.choose("cloud"));
                  }}
                >
                  {tr("ใช้ข้อมูลจากคลาวด์")}
                </button>
              )}
            </div>
          )}
          <div className="backup-actions">
            <button
              className="secondary"
              disabled={busy || sync.state === "syncing"}
              onClick={() => void action(sync.sync)}
            >
              {tr("ซิงก์ตอนนี้")}
            </button>
            <button
              className="secondary"
              disabled={busy || sync.state === "syncing"}
              onClick={() => void action(sync.signOut)}
            >
              {tr("ออกจากระบบอุปกรณ์นี้")}
            </button>
          </div>
          <p className="caption">
            {tr(
              "ออกจากระบบแล้วข้อมูลยังอยู่ในเบราว์เซอร์นี้ ผู้ใช้เครื่องร่วมกันควรล้างข้อมูลอุปกรณ์หลังสำรอง",
            )}
          </p>
        </>
      )}
      {(message || sync.error) && (
        <p role="alert">{tr(message || sync.error)}</p>
      )}
    </section>
  );
}
