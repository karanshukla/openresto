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

/** One labelled example: its heading row (with the copy control), the request, and its caption. */
function Snippet({
  label,
  code,
  hint,
  testID,
  copyLabel,
  copiedLabel,
  copied,
  onCopy,
  borderColor,
  mutedColor,
  background,
}: {
  label: string;
  code: string;
  hint: string;
  testID: string;
  copyLabel: string;
  copiedLabel: string;
  copied: boolean;
  onCopy: () => void;
  borderColor: string;
  mutedColor: string;
  background: string;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.snippet}>
      <View style={styles.snippetHeader}>
        <ThemedText style={settingsStyles.fieldLabel}>{label}</ThemedText>
        {Platform.OS === "web" && (
          <Button
            variant="ghost"
            size="sm"
            tone="neutral"
            icon={copied ? "checkmark" : "copy-outline"}
            onPress={onCopy}
            accessibilityLabel={copied ? copiedLabel : copyLabel}
          >
            {copied
              ? t("admin.settings.apiKeyUsage.copiedButton")
              : t("admin.settings.apiKeyUsage.copyButton")}
          </Button>
        )}
      </View>

      <View style={[styles.codeBlock, { borderColor, backgroundColor: background }]}>
        <ThemedText style={styles.code} selectable testID={testID}>
          {code}
        </ThemedText>
      </View>

      <ThemedText style={[styles.hint, { color: mutedColor }]}>{hint}</ThemedText>
    </View>
  );
}

/**
 * What to do with a key once it exists: the header it goes on, the two shapes a request takes
 * (a terminal one to prove the key is live, a fetch to lift into a script), and the way out to
 * the client, the guide and the source.
 *
 * The two examples sit side by side and wrap rather than switching on viewport width, for the
 * same reason `ButtonRow` does: this card is dropped into a column whose width it doesn't know.
 *
 * The three destinations come from `/api/brand`, defaulted server-side to the upstream OpenResto
 * URLs, so a fork shipping its own client or docs redirects them without rebuilding this app.
 * Their labels stay generic for the same reason — a fork configures where "Command-line client"
 * goes, not what it is called. A destination the server doesn't resolve is simply not offered.
 * Neither example names a client for the same reason: both are plain HTTP, which every fork has.
 *
 * @see [ApiKeyUsageCard.test.tsx](../../../tests/components/admin/settings/ApiKeyUsageCard.test.tsx) —
 * pins that an unresolved destination is dropped rather than rendered as a dead link, and that
 * both examples name this deployment's own API base.
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
  const [copied, setCopied] = useState<"terminal" | "code" | null>(null);

  const base = apiBaseUrl(brand.websiteUrl);

  // The terminal example is a real request against this deployment, so it is worth pasting: the
  // one endpoint every key reaches whatever its scopes, which makes it the "does this key work"
  // check. A placeholder stands in for the secret — nothing here has it, and #319's whole point
  // is that nothing ever gets it back after creation. The script example reads it from the
  // environment instead, which is where a key an integration actually uses belongs.
  const terminalExample = [
    'curl -H "X-API-Key: YOUR_KEY" \\',
    `  ${base}/admin/api-keys/self`,
  ].join("\n");

  const codeExample = [
    `const res = await fetch("${base}/admin/bookings", {`,
    '  headers: { "X-API-Key": process.env.API_KEY },',
    "});",
  ].join("\n");

  const handleCopy = (id: "terminal" | "code", text: string) => {
    if (Platform.OS === "web" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
    }
    setCopied(id);
    setTimeout(() => setCopied((current) => (current === id ? null : current)), 2000);
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
        <View style={[settingsStyles.secForm, { borderTopColor: borderColor, gap: 20 }]}>
          <ThemedText style={styles.intro}>{t("admin.settings.apiKeyUsage.intro")}</ThemedText>

          <View style={styles.snippetRow}>
            <Snippet
              label={t("admin.settings.apiKeyUsage.terminalHeading")}
              code={terminalExample}
              hint={t("admin.settings.apiKeyUsage.terminalHint")}
              testID="api-key-curl-example"
              copyLabel={t("admin.settings.apiKeyUsage.copyTerminalLabel")}
              copiedLabel={t("admin.settings.apiKeyUsage.copiedTerminalLabel")}
              copied={copied === "terminal"}
              onCopy={() => handleCopy("terminal", terminalExample)}
              borderColor={borderColor}
              mutedColor={mutedColor}
              background={surface2}
            />
            <Snippet
              label={t("admin.settings.apiKeyUsage.codeHeading")}
              code={codeExample}
              hint={t("admin.settings.apiKeyUsage.codeHint")}
              testID="api-key-fetch-example"
              copyLabel={t("admin.settings.apiKeyUsage.copyCodeLabel")}
              copiedLabel={t("admin.settings.apiKeyUsage.copiedCodeLabel")}
              copied={copied === "code"}
              onCopy={() => handleCopy("code", codeExample)}
              borderColor={borderColor}
              mutedColor={mutedColor}
              background={surface2}
            />
          </View>

          {offered.length > 0 && (
            <View style={styles.links}>
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
