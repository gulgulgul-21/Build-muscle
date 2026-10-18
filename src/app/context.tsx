import { useLanguage } from "../i18n/LanguageProvider";
import { createContext, useContext, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { readAll } from "../db/repository";
import type { Backup } from "../domain/model";
type ContextValue = {
  data: Backup["data"];
  run: (fn: () => Promise<unknown>) => Promise<boolean>;
  busy: boolean;
};
const DataContext = createContext<ContextValue | null>(null);
export function DataProvider({ children }: { children: ReactNode }) {
  const { t: tr } = useLanguage();

  const data = useLiveQuery(readAll, []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      setError("");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "ไม่สามารถบันทึกข้อมูลได้");
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return <main className="loading">{tr("กำลังเปิดพื้นที่ฝึก…")}</main>;
  return (
    <DataContext.Provider value={{ data, run, busy }}>
      {error && (
        <div className="error global" role="alert">
          {tr(error)}
          <button onClick={() => setError("")}>{tr("ปิด")}</button>
        </div>
      )}
      {children}
    </DataContext.Provider>
  );
}
export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("Missing provider");
  return context;
}
