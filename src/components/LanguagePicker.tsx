import { useLanguage, type Language } from "../i18n/LanguageProvider";
import { useData } from "../app/context";
export function LanguagePicker() {
  const { language, setLanguage } = useLanguage();
  const { run, busy } = useData();
  return (
    <label className="language-picker">
      <span>ภาษา / Language</span>
      <select
        aria-label="ภาษา / Language"
        value={language}
        disabled={busy}
        onChange={(event) =>
          void run(() => setLanguage(event.target.value as Language))
        }
      >
        <option value="th">ไทย</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
