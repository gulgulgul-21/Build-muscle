import { useLanguage } from "../i18n/LanguageProvider";
import { HashRouter, NavLink, Routes, Route } from "react-router-dom";
import {
  House,
  Dumbbell,
  ChartNoAxesCombined,
  Settings as SettingsIcon,
  ArrowUpRight,
  Check,
} from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { DataProvider } from "./context";
import { Home } from "../features/dashboard/Home";
import { WorkoutHub, PlanEditor, Library } from "../features/programs/Programs";
import { ActiveWorkout, Summary } from "../features/workout/Workout";
import { lazy, Suspense, useEffect, useState } from "react";
const Progress = lazy(() =>
  import("../features/progress/Progress").then((m) => ({
    default: m.Progress,
  })),
);
import { Settings } from "../features/settings/Settings";
import { LanguagePicker } from "../components/LanguagePicker";
function Shell() {
  const { t: tr } = useLanguage();
  const [cached, setCached] = useState(false);
  useEffect(() => {
    let mounted = true;
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.ready.then((registration) => {
        if (mounted && registration.active) setCached(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const {
    offlineReady: [ready],
    needRefresh: [update],
    updateServiceWorker,
  } = useRegisterSW();
  return (
    <>
      <div className="brandbar">
        <a className="brand" href="#/">
          <span className="brand-mark">f.</span>form
          <span className="brand-sub">PERSONAL CALISTHENICS</span>
        </a>
        <div className="header-tools">
          <span className="local-badge">
            <span />
            {tr("พื้นที่ของคุณ")}
          </span>
          <LanguagePicker />
        </div>
      </div>
      <main>
        <Suspense fallback={<p className="loading">{tr("กำลังเปิด…")}</p>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/workout" element={<WorkoutHub />} />
            <Route path="/workout/active" element={<ActiveWorkout />} />
            <Route path="/workout/summary/:id" element={<Summary />} />
            <Route path="/workout/plan" element={<PlanEditor />} />
            <Route path="/workout/library" element={<Library />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
        <footer className="page-footer">
          {tr("ค่อย ๆ แข็งแรงขึ้น ในจังหวะของคุณ")}
          {(ready || cached) && (
            <span>
              <Check size={13} />
              {tr("พร้อมใช้งานออฟไลน์บนอุปกรณ์นี้")}
            </span>
          )}
        </footer>
      </main>
      {update && (
        <aside className="update">
          {tr("มีเวอร์ชันใหม่ · บันทึกและจบการฝึกก่อนอัปเดต")}
          <button onClick={() => void updateServiceWorker(true)}>
            {tr("อัปเดต ")}
            <ArrowUpRight size={14} />
          </button>
        </aside>
      )}
      <nav className="bottom-nav" aria-label={tr("เมนูหลัก")}>
        {[
          { to: "/", label: "Home", th: tr("หน้าแรก"), icon: House },
          { to: "/workout", label: "Workout", th: tr("ฝึก"), icon: Dumbbell },
          {
            to: "/progress",
            label: "Progress",
            th: tr("พัฒนาการ"),
            icon: ChartNoAxesCombined,
          },
          {
            to: "/settings",
            label: "Settings",
            th: tr("ตั้งค่า"),
            icon: SettingsIcon,
          },
        ].map(({ to, th, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === "/"} aria-label={th}>
            <Icon size={21} />
            <span>{th}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
}
export default function App() {
  return (
    <HashRouter>
      <DataProvider>
        <Shell />
      </DataProvider>
    </HashRouter>
  );
}
