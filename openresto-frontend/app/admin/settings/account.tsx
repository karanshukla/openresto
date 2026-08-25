import { useTranslation } from "react-i18next";
import { SecurityCard } from "@/components/admin/settings/SecurityCard";
import { SettingsPage, useSettingsPalette } from "@/components/admin/settings/SettingsPage";

export default function AccountSettingsScreen() {
  const { t } = useTranslation();
  const palette = useSettingsPalette();

  return (
    <SettingsPage
      title={t("admin.settings.accountRoute.title")}
      subtitle={t("admin.settings.accountRoute.subtitle")}
    >
      <SecurityCard {...palette} />
    </SettingsPage>
  );
}
