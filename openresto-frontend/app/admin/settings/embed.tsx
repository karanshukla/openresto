import { Redirect } from "expo-router";
import { useTranslation } from "react-i18next";
import { SettingsPage, useSettingsPalette } from "@/components/admin/settings/SettingsPage";
import { EmbedOriginsCard } from "@/components/admin/settings/EmbedOriginsCard";
import { EmbedSnippetCard } from "@/components/admin/settings/EmbedSnippetCard";
import PageLoader from "@/components/common/PageLoader";
import { useAuth, useCan } from "@/context/AuthContext";

/** The booking widget for the restaurant's own site. Owner-only, like the API that backs it. */
export default function EmbedSettingsScreen() {
  const { t } = useTranslation();
  const palette = useSettingsPalette();
  const { status } = useAuth();
  const canManageEmbed = useCan("manage:embed");

  if (status === "loading") return <PageLoader />;
  if (!canManageEmbed) return <Redirect href="/admin/settings/account" />;

  return (
    <SettingsPage
      title={t("admin.settings.embed.route.title")}
      subtitle={t("admin.settings.embed.route.subtitle")}
    >
      <EmbedOriginsCard {...palette} />
      <EmbedSnippetCard {...palette} />
    </SettingsPage>
  );
}
