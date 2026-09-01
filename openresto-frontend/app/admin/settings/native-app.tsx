import { useTranslation } from "react-i18next";
import { SettingsPage, useSettingsPalette } from "@/components/admin/settings/SettingsPage";
import { NativeAppReadinessCard } from "@/components/admin/settings/NativeAppReadinessCard";
import { NativeAppClientsCard } from "@/components/admin/settings/NativeAppClientsCard";
import { NativeAppVersionCard } from "@/components/admin/settings/NativeAppVersionCard";
import { NativeAppSetupCard } from "@/components/admin/settings/NativeAppSetupCard";
import { useNativeAppStatus } from "@/hooks/use-native-app-status";

/**
 * The server's half of publishing the guest app: whether this deployment is ready for a store
 * submission, which builds are using it, and the floor they have to meet. The readiness and
 * client cards render from one request, so Re-check moves the whole page at once.
 */
export default function NativeAppSettingsScreen() {
  const { t } = useTranslation();
  const palette = useSettingsPalette();
  const { status, loading, failed, reload } = useNativeAppStatus();

  return (
    <SettingsPage
      title={t("admin.settings.nativeApp.route.title")}
      subtitle={t("admin.settings.nativeApp.route.subtitle")}
    >
      <NativeAppReadinessCard
        {...palette}
        status={status}
        loading={loading}
        failed={failed}
        onRecheck={reload}
      />
      <NativeAppClientsCard {...palette} status={status} loading={loading} />
      <NativeAppVersionCard {...palette} />
      <NativeAppSetupCard {...palette} serverUrl={status?.serverUrl ?? null} />
    </SettingsPage>
  );
}
