import { StrictMode, Component, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import { initialize } from "./db/repository";
import { LanguageProvider, useLanguage } from "./i18n/LanguageProvider";
import "./styles/index.css";
function ErrorScreen() {
  const { t } = useLanguage();
  return (
    <main>
      <h1>{t("เปิดข้อมูลไม่สำเร็จ")}</h1>
      <p>
        {t(
          "ลองเปิดใหม่ ตรวจสอบว่าเบราว์เซอร์อนุญาต IndexedDB อย่าล้างข้อมูลก่อนสำรอง",
        )}
      </p>
      <button onClick={() => location.reload()}>{t("ลองใหม่")}</button>
    </main>
  );
}
class Boundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? <ErrorScreen /> : this.props.children;
  }
}
initialize()
  .then(() =>
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <LanguageProvider>
          <Boundary>
            <App />
          </Boundary>
        </LanguageProvider>
      </StrictMode>,
    ),
  )
  .catch(() => {
    document.getElementById("root")!.textContent =
      "ไม่สามารถเปิดพื้นที่จัดเก็บได้ กรุณาอนุญาต IndexedDB และเปิดแอปใหม่ / Unable to open storage. Allow IndexedDB and reopen the app.";
  });
