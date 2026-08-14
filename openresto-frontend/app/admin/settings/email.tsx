import { EmailSettingsCard } from "@/components/admin/settings/EmailSettingsCard";
import { PushNotificationsCard } from "@/components/admin/settings/PushNotificationsCard";
import { SettingsPage, useSettingsPalette } from "@/components/admin/settings/SettingsPage";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function EmailSettingsScreen() {
  const palette = useSettingsPalette();
  const { isDark } = useAppTheme();

  return (
    <SettingsPage
      title="Email & Push"
      subtitle="Email delivery, guest confirmations, and push alerts."
    >
      <EmailSettingsCard {...palette} isDark={isDark} />
      <PushNotificationsCard />
    </SettingsPage>
  );
}
