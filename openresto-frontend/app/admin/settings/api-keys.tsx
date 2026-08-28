import { Redirect } from "expo-router";
import { useTranslation } from "react-i18next";
import { SettingsPage, useSettingsPalette } from "@/components/admin/settings/SettingsPage";
import { ApiKeysCard } from "@/components/admin/settings/ApiKeysCard";
import PageLoader from "@/components/common/PageLoader";
import { useAuth, useCan } from "@/context/AuthContext";

export default function ApiKeysSettingsScreen() {
  const { t } = useTranslation();
  const palette = useSettingsPalette();
  const { status } = useAuth();
  // The API refuses these calls for a Manager, so the route is a dead end rather than a
  // disabled screen. The sidebar hides the entry too; this catches a typed-in URL.
  const canManageApiKeys = useCan("manage:api-keys");

  // An unresolved session has no role yet, so waiting is the difference between an Owner
  // landing here and an Owner being bounced to Account on a cold load.
  if (status === "loading") return <PageLoader />;
  if (!canManageApiKeys) return <Redirect href="/admin/settings/account" />;

  return (
    <SettingsPage
      title={t("admin.settings.apiKeysRoute.title")}
      subtitle={t("admin.settings.apiKeysRoute.subtitle")}
    >
      <ApiKeysCard {...palette} />
    </SettingsPage>
  );
}
