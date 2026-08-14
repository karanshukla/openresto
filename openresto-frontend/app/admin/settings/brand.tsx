import { BrandSettingsCard } from "@/components/admin/settings/BrandSettingsCard";
import { FooterSettingsCard } from "@/components/admin/settings/FooterSettingsCard";
import { HighlightsCard } from "@/components/admin/settings/HighlightsCard";
import { SettingsPage, useSettingsPalette } from "@/components/admin/settings/SettingsPage";

export default function BrandSettingsScreen() {
  const palette = useSettingsPalette();

  return (
    <SettingsPage title="Brand" subtitle="How the site looks and what it says about you.">
      <BrandSettingsCard {...palette} />
      <FooterSettingsCard {...palette} />
      <HighlightsCard {...palette} />
    </SettingsPage>
  );
}
