import { EmailDeliveryPanel } from "@/components/admin/settings/EmailDeliveryPanel";
import { EmailSettingsCard } from "@/components/admin/settings/EmailSettingsCard";
import { PushNotificationsCard } from "@/components/admin/settings/PushNotificationsCard";
import { SettingsPage, useSettingsPalette } from "@/components/admin/settings/SettingsPage";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEmailSettings } from "@/hooks/use-email-settings";

export default function EmailSettingsScreen() {
  const palette = useSettingsPalette();
  const { isDark } = useAppTheme();
  // Owned here so the form and the delivery panel beside it stay one source of truth.
  const email = useEmailSettings();

  return (
    <SettingsPage
      title="Email & Push"
      subtitle="Email delivery, guest confirmations, and push alerts."
      aside={<EmailDeliveryPanel {...palette} isDark={isDark} email={email} />}
    >
      <EmailSettingsCard {...palette} isDark={isDark} email={email} />
      <PushNotificationsCard />
    </SettingsPage>
  );
}
