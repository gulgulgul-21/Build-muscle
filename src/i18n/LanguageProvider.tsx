import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { enUS, th } from "date-fns/locale";
import { useLiveQuery } from "dexie-react-hooks";
import { db, saveSettings } from "../db/repository";
import english from "./en.json";
import syncEnglish from "./sync-en.json";
export type Language = "th" | "en";
export function translate(
  language: Language,
  text: string,
  ...values: unknown[]
) {
  const key = text.trim().replace(/\s+/g, " ");
  const dictionary: Record<string, string> = { ...english, ...syncEnglish };
  const translated = language === "en" ? (dictionary[key] ?? key) : key;
  const leading = text.match(/^ +/)?.[0] || "";
  const trailing = text.match(/ +$/)?.[0] || "";
  return (
    leading +
    translated.replace(/\{(\d+)\}/g, (_, index: string) =>
      String(values[Number(index)] ?? ""),
    ) +
    trailing
  );
}
type LanguageContextValue = {
  language: Language;
  t: (text: string, ...values: unknown[]) => string;
  dateLocale: typeof th;
  intlLocale: string;
  setLanguage: (language: Language) => Promise<void>;
};
const LanguageContext = createContext<LanguageContextValue>({
  language: "th",
  t: (text, ...values) => translate("th", text, ...values),
  dateLocale: th,
  intlLocale: "th-TH",
  setLanguage: async () => {},
});
export function LanguageProvider({ children }: { children: ReactNode }) {
  const settings = useLiveQuery(() => db.settings.toCollection().first(), []);
  const language = settings?.language ?? "th";
  useEffect(() => {
    document.documentElement.lang = language;
    document.title =
      language === "th"
        ? "Form — ฝึก Calisthenics ส่วนตัว"
        : "Form — Personal Calisthenics";
  }, [language]);
  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      t: (text, ...values) => translate(language, text, ...values),
      dateLocale: language === "en" ? enUS : th,
      intlLocale: language === "en" ? "en-GB" : "th-TH",
      setLanguage: async (language) => {
        const current = await db.settings.toCollection().first();
        if (current) await saveSettings({ ...current, language });
      },
    }),
    [language],
  );
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}
export function useLanguage() {
  return useContext(LanguageContext);
}
