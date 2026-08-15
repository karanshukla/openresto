import { BrandDraftProvider } from "@/components/admin/settings/BrandDraftContext";
import { BrandPreview } from "@/components/admin/settings/BrandPreview";
import { BrandSettingsCard } from "@/components/admin/settings/BrandSettingsCard";
import { ContactSettingsCard } from "@/components/admin/settings/ContactSettingsCard";
import { FooterSettingsCard } from "@/components/admin/settings/FooterSettingsCard";
import { HeaderImageCard } from "@/components/admin/settings/HeaderImageCard";
import { HighlightsCard } from "@/components/admin/settings/HighlightsCard";
import { SettingsPage, useSettingsPalette } from "@/components/admin/settings/SettingsPage";

export default function BrandSettingsScreen() {
  const palette = useSettingsPalette();

  return (
    <BrandDraftProvider>
      <SettingsPage
        title="Brand"
        subtitle="How the site looks and what it says about you."
        aside={<BrandPreview {...palette} />}
      >
        <BrandSettingsCard {...palette} />
        <HeaderImageCard {...palette} />
        <ContactSettingsCard {...palette} />
        <HighlightsCard {...palette} />
        <FooterSettingsCard {...palette} />
      </SettingsPage>
    </BrandDraftProvider>
  );
}
