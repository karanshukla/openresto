import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Select from "@/components/common/Select";
import { RowTextButton } from "@/components/common/RowTextButton";
import { Icon } from "@/components/common/Icon";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useBrand } from "@/context/BrandContext";
import { fetchRestaurants, RestaurantDto } from "@/api/restaurants";
import { probeEmbed, type EmbedProbeResult } from "@/utils/embedProbe";
import { styles as settingsStyles } from "./settings.styles";
import { AccordionCardHeader } from "./AccordionCardHeader";
import { COPY_CONFIRMATION_MS, copyToClipboard } from "./clipboard";
import { resolveServerAddress } from "./NativeAppSetupCard";
import { styles } from "./EmbedSnippetCard.styles";

const ALL_LOCATIONS = 0;

/**
 * The two ways onto a restaurant's site: the script, which frames the widget and sizes it to
 * its content, and a plain link for site builders that strip scripts. The script is only
 * offered once `probeEmbed` has seen this deployment's proxy send the headers it needs; a
 * plain link opens the page at the top level, so it works either way.
 *
 * @see [EmbedSnippetCard.test.tsx](../../../tests/components/admin/settings/EmbedSnippetCard.test.tsx):
 * pins that both snippets name this server and the picked location, and that "all locations"
 * leaves the location out.
 */
export function embedSnippets(server: string, locationId: number) {
  const base = server.replace(/\/+$/, "");
  const location = locationId === ALL_LOCATIONS ? "" : String(locationId);
  return {
    script: `<script src="${base}/embed.js"${location && ` data-location="${location}"`}></script>`,
    link: `<a href="${base}/embed${location && `?location=${location}`}" target="_blank">Book a table</a>`,
  };
}

function Snippet({ label, code, testID }: { label: string; code: string; testID: string }) {
  const { t } = useTranslation();
  const { isDark, primaryColor, colors } = useAppTheme();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const handleCopy = async () => {
    if (!(await copyToClipboard(code))) return;
    setCopied(true);
    timer.current = setTimeout(() => setCopied(false), COPY_CONFIRMATION_MS);
  };

  return (
    <View>
      <View style={styles.commandHeader}>
        <ThemedText style={settingsStyles.fieldLabel}>{label}</ThemedText>
        {Platform.OS === "web" && (
          <RowTextButton
            label={
              copied
                ? t("admin.settings.nativeApp.setup.copied")
                : t("admin.settings.nativeApp.setup.copy")
            }
            icon={copied ? "checkmark" : "copy-outline"}
            color={primaryColor}
            testID={`${testID}-copy`}
            onPress={handleCopy}
          />
        )}
      </View>
      <View
        style={[
          styles.commandBlock,
          { borderColor: colors.border, backgroundColor: isDark ? "#252729" : "#f9fafb" },
        ]}
      >
        <ThemedText style={styles.command} selectable testID={testID}>
          {code}
        </ThemedText>
      </View>
    </View>
  );
}

function ProbeStatus({
  probe,
  mutedColor,
  onRecheck,
}: {
  probe: EmbedProbeResult | null;
  mutedColor: string;
  onRecheck: () => void;
}) {
  const { t } = useTranslation();
  const { primaryColor, colors } = useAppTheme();

  if (!probe) {
    return (
      <View style={styles.probe} testID="embed-probe-checking">
        <ActivityIndicator size="small" color={mutedColor} />
        <ThemedText style={[styles.hint, { color: mutedColor }]}>
          {t("admin.settings.embed.probe.checking")}
        </ThemedText>
      </View>
    );
  }
  if (probe.ok) {
    return (
      <View style={styles.probe} testID="embed-probe-ok">
        <Icon name="checkmark-circle" size="sm" color={colors.success} />
        <ThemedText style={[styles.hint, { color: mutedColor }]}>
          {t("admin.settings.embed.probe.ok")}
        </ThemedText>
      </View>
    );
  }
  return (
    <View style={styles.probe} testID="embed-probe-problem">
      <Icon name="alert-circle" size="sm" color={colors.error} />
      <ThemedText style={[styles.hint, styles.probeText, { color: colors.error }]}>
        {t(`admin.settings.embed.probe.problems.${probe.problem}`)}
      </ThemedText>
      {probe.problem !== "noOrigins" && (
        <RowTextButton
          label={t("admin.settings.embed.probe.recheck")}
          icon="refresh"
          color={primaryColor}
          testID="embed-probe-recheck"
          onPress={onRecheck}
        />
      )}
    </View>
  );
}

export function EmbedSnippetCard({
  borderColor,
  mutedColor,
  cardBg,
  origins,
}: {
  borderColor: string;
  mutedColor: string;
  cardBg: string;
  /** The saved allowed sites; null until they have loaded. */
  origins: string[] | null;
}) {
  const { t } = useTranslation();
  const { primaryColor } = useAppTheme();
  const brand = useBrand();
  const [expanded, setExpanded] = usePersistedState("settings:embedSnippet:expanded", true);
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [locationId, setLocationId] = useState(ALL_LOCATIONS);

  const [probe, setProbe] = useState<EmbedProbeResult | null>(null);
  const [probeRun, setProbeRun] = useState(0);

  useEffect(() => {
    fetchRestaurants().then(setRestaurants);
  }, []);

  // nginx reads the allowed sites on every load, so a save is visible to the very next probe.
  useEffect(() => {
    if (!origins) return;
    let current = true;
    setProbe(null);
    probeEmbed(origins).then((result) => current && setProbe(result));
    return () => {
      current = false;
    };
  }, [origins, probeRun]);

  const snippets = embedSnippets(resolveServerAddress(null, brand.websiteUrl), locationId);

  return (
    <View
      style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}
      testID="embed-snippet-card"
    >
      <AccordionCardHeader
        icon="code-slash-outline"
        title={t("admin.settings.embed.snippet.title")}
        subtitle={t("admin.settings.embed.snippet.subtitle")}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        primaryColor={primaryColor}
        mutedColor={mutedColor}
      />
      <AnimatedAccordion expanded={expanded}>
        <View style={[settingsStyles.secForm, { borderTopColor: borderColor }, styles.body]}>
          <View>
            <ThemedText style={settingsStyles.fieldLabel}>
              {t("admin.settings.embed.snippet.locationLabel")}
            </ThemedText>
            <Select
              accessibilityLabel={t("admin.settings.embed.snippet.locationLabel")}
              selectedValue={locationId}
              options={[
                { label: t("admin.settings.embed.snippet.allLocations"), value: ALL_LOCATIONS },
                ...restaurants.map((r) => ({ label: r.name, value: r.id })),
              ]}
              onSelect={(value) => setLocationId(Number(value))}
            />
          </View>
          <ProbeStatus
            probe={probe}
            mutedColor={mutedColor}
            onRecheck={() => setProbeRun((n) => n + 1)}
          />
          {probe?.ok && (
            <Snippet
              label={t("admin.settings.embed.snippet.scriptLabel")}
              code={snippets.script}
              testID="embed-snippet-script"
            />
          )}
          <Snippet
            label={t("admin.settings.embed.snippet.linkLabel")}
            code={snippets.link}
            testID="embed-snippet-link"
          />
        </View>
      </AnimatedAccordion>
    </View>
  );
}
