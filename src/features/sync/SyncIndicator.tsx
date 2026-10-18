import { useSync } from "./SyncProvider";
import { useLanguage } from "../../i18n/LanguageProvider";
export function SyncIndicator() {
  const { state } = useSync();
  const { t } = useLanguage();
  const labels = {
    signedOut: "พื้นที่ของคุณ",
    syncing: "กำลังซิงก์…",
    synced: "ซิงก์แล้ว",
    offline: "ออฟไลน์ · จะซิงก์เมื่อเชื่อมต่อ",
    setup: "เลือกข้อมูลเริ่มต้น",
    conflict: "พบข้อมูลขัดแย้ง",
    error: "รอซิงก์อีกครั้ง",
  };
  return (
    <a
      href="#/settings"
      className="local-badge"
      title={t("ซิงก์ระหว่างอุปกรณ์")}
    >
      <span />
      {t(labels[state])}
    </a>
  );
}
