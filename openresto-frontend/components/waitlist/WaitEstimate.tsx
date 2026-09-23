import { useTranslation } from "react-i18next";

/** "A table is free now" / "About 25 min wait" / no table fits, for a quoted wait in minutes. */
export default function WaitEstimate({ minutes }: { minutes: number | null }) {
  const { t } = useTranslation();
  if (minutes === null) return <>{t("booking.waitlist.waitUnknown")}</>;
  if (minutes === 0) return <>{t("booking.waitlist.waitNow")}</>;
  return <>{t("booking.waitlist.waitMinutes", { minutes })}</>;
}
