import { SecurityCard } from "@/components/admin/settings/SecurityCard";
import { SettingsPage, useSettingsPalette } from "@/components/admin/settings/SettingsPage";

export default function AccountSettingsScreen() {
  const palette = useSettingsPalette();

  return (
    <SettingsPage title="Account" subtitle="Your own sign-in details and recovery question.">
      <SecurityCard {...palette} />
    </SettingsPage>
  );
}
