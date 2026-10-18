import { useLanguage } from "../i18n/LanguageProvider";
import type { Exercise, Target } from "../domain/model";
export function Prescription({
  target,
  exercise,
}: {
  target: Target;
  exercise?: Exercise;
}) {
  const { t } = useLanguage();
  return (
    <span className="prescription">
      <span>
        {Number.isNaN(target.sets) ? "—" : target.sets} {t("เซต")}
      </span>
      <span>
        {" × "}
        {Number.isNaN(target.min) ? "—" : target.min}
        {target.min !== target.max
          ? `–${Number.isNaN(target.max) ? "—" : target.max}`
          : ""}{" "}
        {t(
          exercise?.modality === "hold"
            ? "วินาที"
            : exercise?.perSide
              ? "ครั้งต่อข้าง"
              : "ครั้ง",
        )}
      </span>
    </span>
  );
}
