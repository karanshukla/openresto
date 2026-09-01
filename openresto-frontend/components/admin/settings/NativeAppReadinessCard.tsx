import { ActivityIndicator, Platform, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { ButtonRow } from "@/components/common/ButtonRow";
import { RowTextButton } from "@/components/common/RowTextButton";
import { Icon, type IconName } from "@/components/common/Icon";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useAppTheme } from "@/hooks/use-app-theme";
import { theme } from "@/theme/theme";
import type { NativeAppCheck, NativeAppCheckStatus, NativeAppStatus } from "@/api/nativeApp";
import { styles as settingsStyles } from "./settings.styles";
import { AccordionCardHeader } from "./AccordionCardHeader";
import { styles } from "./NativeAppReadinessCard.styles";

/** Glyph and tint per outcome. A skip is deliberately quiet: nothing failed, nothing ran. */
const GLYPHS: Record<NativeAppCheckStatus, IconName> = {
  pass: "checkmark-circle",
  fail: "alert-circle",
  skip: "remove",
};

/** Opens a check's own URL in a new tab. The admin is web-only, so there is no native path. */
function openUrl(url: string) {
  /* istanbul ignore else -- the admin never mounts off web; the guard is the contract, not a branch */
  if (Platform.OS === "web") window.open(url, "_blank", "noopener,noreferrer");
}

function CheckRow({
  check,
  mutedColor,
  tint,
  primaryColor,
}: {
  check: NativeAppCheck;
  mutedColor: string;
  tint: string;
  primaryColor: string;
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.check} testID={`native-app-check-${check.id}`}>
      <View style={styles.checkGlyph}>
        <Icon
          name={GLYPHS[check.status]}
          size="md"
          color={tint}
          label={t(`admin.settings.nativeApp.readiness.outcome.${check.status}`)}
        />
      </View>
      <View style={styles.checkCopy}>
        <ThemedText style={styles.checkLabel}>
          {t(`admin.settings.nativeApp.checks.${check.id}.label`)}
        </ThemedText>
        {check.status !== "pass" && (
          <ThemedText style={[styles.checkText, { color: mutedColor }]}>
            {t(`admin.settings.nativeApp.checks.${check.id}.fix`)}
          </ThemedText>
        )}
        {check.detail && (
          <ThemedText style={[styles.checkText, { color: mutedColor }]}>{check.detail}</ThemedText>
        )}
      </View>
      {check.url && (
        <RowTextButton
          label={t("admin.settings.nativeApp.readiness.open")}
          color={primaryColor}
          icon="open-outline"
          testID={`native-app-check-open-${check.id}`}
          onPress={() => openUrl(check.url!)}
        />
      )}
    </View>
  );
}

/**
 * What a store submission or a deep link would fail on today, answered by the server rather
 * than by this app: two of the five checks are the server fetching `.well-known` files back
 * from its own public domain, which is the only place that can tell whether the copy actually
 * landed on the proxy. Each failing row carries the fix, so the page is actionable without the
 * guide open beside it.
 *
 * The status is passed in rather than fetched here: the client list renders from the same
 * payload, and Re-check has to move both. See `hooks/use-native-app-status.ts`.
 *
 * @see [NativeAppReadinessCard.test.tsx](../../../tests/components/admin/settings/NativeAppReadinessCard.test.tsx) —
 * pins that a failing check shows its fix and a passing one does not, that a refused request
 * offers a retry rather than an empty checklist, and that Re-check refetches.
 */
export function NativeAppReadinessCard({
  borderColor,
  mutedColor,
  cardBg,
  status,
  loading,
  failed,
  onRecheck,
}: {
  borderColor: string;
  mutedColor: string;
  cardBg: string;
  status: NativeAppStatus | null;
  loading: boolean;
  failed: boolean;
  onRecheck: () => void;
}) {
  const { t } = useTranslation();
  const { primaryColor } = useAppTheme();
  const [expanded, setExpanded] = usePersistedState("settings:nativeAppReadiness:expanded", true);

  const tints: Record<NativeAppCheckStatus, string> = {
    pass: theme.colors.success,
    fail: theme.colors.error,
    skip: mutedColor,
  };

  const failures = status?.checks.filter((check) => check.status === "fail").length ?? 0;
  const subtitle = loading
    ? t("admin.settings.nativeApp.readiness.loading")
    : !status
      ? t("admin.settings.nativeApp.readiness.loadFailed")
      : failures > 0
        ? t("admin.settings.nativeApp.readiness.failureCount", { count: failures })
        : t("admin.settings.nativeApp.readiness.allPassing");

  return (
    <View
      style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}
      testID="native-app-readiness-card"
    >
      <AccordionCardHeader
        icon="shield-checkmark-outline"
        title={t("admin.settings.nativeApp.readiness.title")}
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
              <ThemedText style={[styles.checkText, { color: mutedColor }]}>
                {t("admin.settings.nativeApp.readiness.loading")}
              </ThemedText>
            </View>
          )}

          {!loading && failed && (
            <>
              <ThemedText style={[styles.checkText, { color: mutedColor }]}>
                {t("admin.settings.nativeApp.readiness.loadFailed")}
              </ThemedText>
              <ButtonRow align="start">
                <Button
                  variant="secondary"
                  tone="neutral"
                  size="md"
                  icon="refresh-outline"
                  testID="native-app-readiness-retry"
                  onPress={onRecheck}
                >
                  {t("admin.settings.nativeApp.readiness.retry")}
                </Button>
              </ButtonRow>
            </>
          )}

          {!loading && status && (
            <>
              <View style={styles.intro}>
                <ThemedText style={settingsStyles.fieldLabel}>
                  {t("admin.settings.nativeApp.readiness.serverUrlLabel")}
                </ThemedText>
                {status.serverUrl ? (
                  <ThemedText style={styles.serverUrl} selectable testID="native-app-server-url">
                    {status.serverUrl}
                  </ThemedText>
                ) : (
                  <View style={styles.notice}>
                    <Icon name="alert-circle-outline" size="sm" color={theme.colors.warning} />
                    <ThemedText style={[styles.noticeText, { color: mutedColor }]}>
                      {t("admin.settings.nativeApp.readiness.noServerUrl")}
                    </ThemedText>
                  </View>
                )}
              </View>

              <View style={styles.checks}>
                {status.checks.map((check) => (
                  <CheckRow
                    key={check.id}
                    check={check}
                    mutedColor={mutedColor}
                    tint={tints[check.status]}
                    primaryColor={primaryColor}
                  />
                ))}
              </View>

              <ButtonRow align="start">
                <Button
                  variant="secondary"
                  tone="neutral"
                  size="md"
                  icon="refresh-outline"
                  testID="native-app-recheck"
                  onPress={onRecheck}
                >
                  {t("admin.settings.nativeApp.readiness.recheck")}
                </Button>
              </ButtonRow>
            </>
          )}
        </View>
      </AnimatedAccordion>
    </View>
  );
}

export default NativeAppReadinessCard;
