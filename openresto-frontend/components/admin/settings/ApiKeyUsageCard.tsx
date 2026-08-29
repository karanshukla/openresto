import { useState } from "react";
import { Linking, Platform, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { ButtonRow } from "@/components/common/ButtonRow";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useBrand } from "@/context/BrandContext";
import { apiBaseUrl } from "@/utils/apiBaseUrl";
import { type IconName } from "@/components/common/Icon";
import { styles as settingsStyles } from "./settings.styles";
import { AccordionCardHeader } from "./AccordionCardHeader";
import { styles } from "./ApiKeyUsageCard.styles";

/**
 * What to do with a key once it exists: the header it goes on, a request to paste to prove it
 * works, and the way out to the client, the guide and the source.
 *
 * The three destinations come from `/api/brand`, defaulted server-side to the upstream OpenResto
 * URLs, so a fork shipping its own client or docs redirects them without rebuilding this app.
 * Their labels stay generic for the same reason — a fork configures where "Command-line client"
 * goes, not what it is called. A destination the server doesn't resolve is simply not offered.
 *
 * @see [ApiKeyUsageCard.test.tsx](../../../tests/components/admin/settings/ApiKeyUsageCard.test.tsx) —
 * pins that an unresolved destination is dropped rather than rendered as a dead link, and that the
 * example names this deployment's own API base.
 */
export function ApiKeyUsageCard({
  borderColor,
  mutedColor,
  cardBg,
}: {
  borderColor: string;
  mutedColor: string;
  cardBg: string;
}) {
  const { t } = useTranslation();
  const { isDark, primaryColor } = useAppTheme();
  const brand = useBrand();
  const surface2 = isDark ? "#252729" : "#f9fafb";

  const [expanded, setExpanded] = usePersistedState("settings:apiKeyUsage:expanded", true);
  const [copied, setCopied] = useState(false);

  // The example is a real request against this deployment, so it is worth pasting: the one
  // endpoint every key reaches whatever its scopes, which makes it the "does this key work"
  // check. A placeholder stands in for the secret — nothing here has it, and #319's whole
  // point is that nothing ever gets it back after creation.
  const example = [
    'curl -H "X-API-Key: YOUR_KEY" \\',
    `  ${apiBaseUrl(brand.websiteUrl)}/admin/api-keys/self`,
  ].join("\n");

  const handleCopy = () => {
    if (Platform.OS === "web" && navigator.clipboard) {
      navigator.clipboard.writeText(example);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const links: { url?: string; label: string; icon: IconName; testID: string }[] = [
    {
      url: brand.cliPackageUrl,
      label: t("admin.settings.apiKeyUsage.cliLink"),
      icon: "terminal-outline",
      testID: "api-key-cli-link",
    },
    {
      url: brand.apiDocsUrl,
      label: t("admin.settings.apiKeyUsage.docsLink"),
      icon: "book-outline",
      testID: "api-key-docs-link",
    },
    {
      url: brand.repositoryUrl,
      label: t("admin.settings.apiKeyUsage.repoLink"),
      icon: "code-slash-outline",
      testID: "api-key-repo-link",
    },
  ];
  const offered = links.filter((link) => !!link.url);

  return (
    <View
      style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}
      testID="api-key-usage-card"
    >
      <AccordionCardHeader
        icon="code-slash-outline"
        title={t("admin.settings.apiKeyUsage.title")}
        subtitle={t("admin.settings.apiKeyUsage.subtitle")}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        primaryColor={primaryColor}
        mutedColor={mutedColor}
      />

      <AnimatedAccordion expanded={expanded}>
        <View style={[settingsStyles.secForm, { borderTopColor: borderColor, gap: 16 }]}>
          <View style={styles.block}>
            <ThemedText style={settingsStyles.fieldLabel}>
              {t("admin.settings.apiKeyUsage.httpHeading")}
            </ThemedText>
            <ThemedText style={styles.body}>{t("admin.settings.apiKeyUsage.httpBody")}</ThemedText>

            <View style={[styles.codeBlock, { borderColor, backgroundColor: surface2 }]}>
              <ThemedText style={styles.code} selectable testID="api-key-curl-example">
                {example}
              </ThemedText>
              {Platform.OS === "web" && (
                <Button
                  variant="ghost"
                  size="sm"
                  tone="neutral"
                  icon={copied ? "checkmark" : "copy-outline"}
                  onPress={handleCopy}
                  accessibilityLabel={
                    copied
                      ? t("admin.settings.apiKeyUsage.copiedLabel")
                      : t("admin.settings.apiKeyUsage.copyLabel")
                  }
                >
                  {copied
                    ? t("admin.settings.apiKeyUsage.copiedButton")
                    : t("admin.settings.apiKeyUsage.copyButton")}
                </Button>
              )}
            </View>

            <ThemedText style={[styles.hint, { color: mutedColor }]}>
              {t("admin.settings.apiKeyUsage.httpHint")}
            </ThemedText>
          </View>

          {offered.length > 0 && (
            <View style={styles.block}>
              <ThemedText style={settingsStyles.fieldLabel}>
                {t("admin.settings.apiKeyUsage.linksHeading")}
              </ThemedText>
              <ButtonRow align="start">
                {offered.map((link) => (
                  <Button
                    key={link.testID}
                    variant="secondary"
                    tone="neutral"
                    size="md"
                    icon={link.icon}
                    testID={link.testID}
                    onPress={() => Linking.openURL(link.url!)}
                  >
                    {link.label}
                  </Button>
                ))}
              </ButtonRow>
            </View>
          )}
        </View>
      </AnimatedAccordion>
    </View>
  );
}

export default ApiKeyUsageCard;
