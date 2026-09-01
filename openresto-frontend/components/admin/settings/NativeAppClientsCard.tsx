import { ActivityIndicator, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { Icon, type IconName } from "@/components/common/Icon";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAppTheme } from "@/hooks/use-app-theme";
import { fmtNumber, relativeTime } from "@/utils/formatters";
import type { NativeAppClient, NativeAppStatus } from "@/api/nativeApp";
import { styles as settingsStyles } from "./settings.styles";
import { AccordionCardHeader } from "./AccordionCardHeader";
import { styles } from "./NativeAppClientsCard.styles";

const PLATFORM_GLYPHS: Record<string, IconName> = {
  ios: "logo-apple",
  android: "logo-android",
};

/**
 * The store's own spelling for a platform we know, and a capitalised fall-back for one we
 * don't — the server reports whatever the app's header said, and an unknown value is data to
 * show rather than a case to hide.
 */
export function platformLabel(platform: string): string {
  const key = platform.toLowerCase();
  if (key === "ios") return "iOS";
  if (key === "android") return "Android";
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

function ClientRow({ client, borderColor }: { client: NativeAppClient; borderColor: string }) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[styles.row, { borderTopWidth: 1, borderTopColor: borderColor }]}
      testID={`native-app-client-${client.platform}-${client.appVersion}`}
    >
      <View style={styles.platformCell}>
        <Icon
          name={PLATFORM_GLYPHS[client.platform.toLowerCase()] ?? "phone-portrait-outline"}
          size="md"
          color={colors.muted}
        />
        <ThemedText style={styles.cellText}>{platformLabel(client.platform)}</ThemedText>
      </View>
      <ThemedText style={[styles.cell, styles.cellText]}>{client.appVersion}</ThemedText>
      <ThemedText style={[styles.cell, styles.cellText, { color: colors.muted }]}>
        {relativeTime(client.lastSeenUtc)}
      </ThemedText>
      <ThemedText style={[styles.countCell, styles.cellText]}>
        {fmtNumber(client.requestsLast7Days)}
      </ThemedText>
      <ThemedText style={[styles.countCell, styles.cellText]}>
        {fmtNumber(client.requestsLast30Days)}
      </ThemedText>
    </View>
  );
}

/**
 * Which builds are actually talking to this server — the answer to "can I retire 1.8.x yet"
 * that a minimum-version floor is set from. Counts only: the server keeps no device
 * identifiers and no addresses, so there is nothing here to identify a guest by.
 *
 * @see [NativeAppClientsCard.test.tsx](../../../tests/components/admin/settings/NativeAppClientsCard.test.tsx) —
 * pins that a connected build lists its platform, version and counts, and that no build yet
 * explains itself rather than showing an empty table.
 */
export function NativeAppClientsCard({
  borderColor,
  mutedColor,
  cardBg,
  status,
  loading,
}: {
  borderColor: string;
  mutedColor: string;
  cardBg: string;
  status: NativeAppStatus | null;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const { primaryColor } = useAppTheme();
  const [expanded, setExpanded] = usePersistedState("settings:nativeAppClients:expanded", true);

  const clients = status?.clients ?? [];
  const subtitle = loading
    ? t("admin.settings.nativeApp.clients.loading")
    : !status
      ? t("admin.settings.nativeApp.clients.loadFailed")
      : t("admin.settings.nativeApp.clients.count", { count: clients.length });

  return (
    <View
      style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}
      testID="native-app-clients-card"
    >
      <AccordionCardHeader
        icon="phone-portrait-outline"
        title={t("admin.settings.nativeApp.clients.title")}
        subtitle={subtitle}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        primaryColor={primaryColor}
        mutedColor={mutedColor}
      />

      <AnimatedAccordion expanded={expanded}>
        <View style={[settingsStyles.secForm, { borderTopColor: borderColor }, styles.body]}>
          {loading && (
            <View style={styles.loading}>
              <ActivityIndicator size="small" color={mutedColor} />
              <ThemedText style={[styles.loadingText, { color: mutedColor }]}>
                {t("admin.settings.nativeApp.clients.loading")}
              </ThemedText>
            </View>
          )}

          {!loading && !status && (
            <ThemedText style={[styles.loadingText, { color: mutedColor }]}>
              {t("admin.settings.nativeApp.clients.loadFailed")}
            </ThemedText>
          )}

          {!loading && status && clients.length === 0 && (
            <View style={[settingsStyles.emptyState, { borderColor }]}>
              <Icon name="phone-portrait-outline" size="xl" color={mutedColor} />
              <ThemedText style={[settingsStyles.emptyStateText, { color: mutedColor }]}>
                {t("admin.settings.nativeApp.clients.empty")}
              </ThemedText>
            </View>
          )}

          {!loading && status && clients.length > 0 && (
            <View>
              <View style={[styles.row, styles.headerRow, { borderBottomColor: borderColor }]}>
                <ThemedText style={[styles.cell, styles.headerText, { color: mutedColor }]}>
                  {t("admin.settings.nativeApp.clients.columns.platform")}
                </ThemedText>
                <ThemedText style={[styles.cell, styles.headerText, { color: mutedColor }]}>
                  {t("admin.settings.nativeApp.clients.columns.appVersion")}
                </ThemedText>
                <ThemedText style={[styles.cell, styles.headerText, { color: mutedColor }]}>
                  {t("admin.settings.nativeApp.clients.columns.lastSeen")}
                </ThemedText>
                <ThemedText style={[styles.countCell, styles.headerText, { color: mutedColor }]}>
                  {t("admin.settings.nativeApp.clients.columns.requests7d")}
                </ThemedText>
                <ThemedText style={[styles.countCell, styles.headerText, { color: mutedColor }]}>
                  {t("admin.settings.nativeApp.clients.columns.requests30d")}
                </ThemedText>
              </View>
              {clients.map((client) => (
                <ClientRow
                  key={`${client.platform}-${client.appVersion}`}
                  client={client}
                  borderColor={borderColor}
                />
              ))}
            </View>
          )}
        </View>
      </AnimatedAccordion>
    </View>
  );
}

export default NativeAppClientsCard;
