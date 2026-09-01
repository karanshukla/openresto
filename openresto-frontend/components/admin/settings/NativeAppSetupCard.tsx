import { useEffect, useRef, useState } from "react";
import { Linking, Platform, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { ButtonRow } from "@/components/common/ButtonRow";
import { RowTextButton } from "@/components/common/RowTextButton";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useBrand } from "@/context/BrandContext";
import { styles as settingsStyles } from "./settings.styles";
import { AccordionCardHeader } from "./AccordionCardHeader";
import { COPY_CONFIRMATION_MS, copyToClipboard } from "./clipboard";
import { styles } from "./NativeAppSetupCard.styles";

/** Shown in place of an address when the deployment has told us none. */
const EXAMPLE_SERVER = "https://bookings.example.com";
const GUIDE_PATH = "/blob/main/docs/native-app.md";

/**
 * The trailing segment of a bundle id: letters and digits only, starting with a letter, which
 * is all `native:init` accepts. A slug's hyphens are legal in an EAS slug and not in an
 * application id, so this is deliberately stricter than `deriveSlug`.
 */
export function bundleIdSuffix(appName: string): string {
  const suffix = appName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return /^[a-z]/.test(suffix) ? suffix : `app${suffix}`;
}

/** The address the generator should be pointed at: what the server checked, else this page. */
export function resolveServerAddress(serverUrl: string | null, websiteUrl?: string): string {
  if (serverUrl) return serverUrl;
  const origin =
    Platform.OS === "web" && typeof window !== "undefined" ? window.location?.origin : undefined;
  return origin || websiteUrl || EXAMPLE_SERVER;
}

/**
 * The one command that starts a store build, filled in for this deployment. Read-only by
 * design: the binary is built from a checkout on the publisher's own machine, so what the
 * admin can usefully do here is copy the invocation rather than configure anything.
 *
 * The bundle id stays `com.example.…` on purpose — it is the app's permanent identity on both
 * stores and has to be a domain the publisher actually owns, which is not something this
 * server knows. The guide link is offered only when `/api/brand` resolved a repository URL,
 * matching `ApiKeyUsageCard`: a fork configures where the guide lives, not whether it exists.
 *
 * @see [NativeAppSetupCard.test.tsx](../../../tests/components/admin/settings/NativeAppSetupCard.test.tsx) —
 * pins that the command names the checked address and a bundle id derived from the brand name,
 * that a copy is confirmed only once the clipboard write landed, and that an unresolved
 * repository URL drops the link rather than rendering a dead one.
 */
export function NativeAppSetupCard({
  borderColor,
  mutedColor,
  cardBg,
  serverUrl,
}: {
  borderColor: string;
  mutedColor: string;
  cardBg: string;
  serverUrl: string | null;
}) {
  const { t } = useTranslation();
  const { isDark, primaryColor } = useAppTheme();
  const brand = useBrand();
  const surface2 = isDark ? "#252729" : "#f9fafb";

  const [expanded, setExpanded] = usePersistedState("settings:nativeAppSetup:expanded", true);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    },
    []
  );

  const command = [
    "npm run native:init -- \\",
    `  --server ${resolveServerAddress(serverUrl, brand.websiteUrl)} \\`,
    `  --bundle-id com.example.${bundleIdSuffix(brand.appName)}`,
  ].join("\n");

  const guideUrl = brand.repositoryUrl
    ? `${brand.repositoryUrl.replace(/\/+$/, "")}${GUIDE_PATH}`
    : null;

  const handleCopy = async () => {
    const ok = await copyToClipboard(command);
    if (!ok) {
      setCopied(false);
      setCopyFailed(true);
      return;
    }
    setCopyFailed(false);
    setCopied(true);
    timers.current.push(setTimeout(() => setCopied(false), COPY_CONFIRMATION_MS));
  };

  return (
    <View
      style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}
      testID="native-app-setup-card"
    >
      <AccordionCardHeader
        icon="hammer-outline"
        title={t("admin.settings.nativeApp.setup.title")}
        subtitle={t("admin.settings.nativeApp.setup.subtitle")}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        primaryColor={primaryColor}
        mutedColor={mutedColor}
      />

      <AnimatedAccordion expanded={expanded}>
        <View style={[settingsStyles.secForm, { borderTopColor: borderColor }, styles.body]}>
          <ThemedText style={styles.intro}>{t("admin.settings.nativeApp.setup.intro")}</ThemedText>

          <View>
            <View style={styles.commandHeader}>
              <ThemedText style={settingsStyles.fieldLabel}>
                {t("admin.settings.nativeApp.setup.commandLabel")}
              </ThemedText>
              {Platform.OS === "web" && (
                <RowTextButton
                  label={
                    copied
                      ? t("admin.settings.nativeApp.setup.copied")
                      : t("admin.settings.nativeApp.setup.copy")
                  }
                  icon={copied ? "checkmark" : "copy-outline"}
                  color={primaryColor}
                  testID="native-app-setup-copy"
                  onPress={handleCopy}
                />
              )}
            </View>
            <View style={[styles.commandBlock, { borderColor, backgroundColor: surface2 }]}>
              <ThemedText style={styles.command} selectable testID="native-app-setup-command">
                {command}
              </ThemedText>
            </View>
          </View>

          <ThemedText style={[styles.hint, { color: mutedColor }]}>
            {copyFailed
              ? t("admin.settings.nativeApp.setup.copyFailed")
              : t("admin.settings.nativeApp.setup.bundleIdHint")}
          </ThemedText>

          {guideUrl && (
            <View style={styles.links}>
              <ButtonRow align="start">
                <Button
                  variant="secondary"
                  tone="neutral"
                  size="md"
                  icon="book-outline"
                  testID="native-app-guide-link"
                  onPress={() => Linking.openURL(guideUrl)}
                >
                  {t("admin.settings.nativeApp.setup.guideLink")}
                </Button>
              </ButtonRow>
            </View>
          )}
        </View>
      </AnimatedAccordion>
    </View>
  );
}

export default NativeAppSetupCard;
