import { Pressable, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/common/Icon";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./ScheduleConflictsBanner.styles";

/**
 * Upcoming bookings that their location's current schedule would no longer accept, totalled
 * across every active location.
 *
 * `/admin/locations` reports these per location, but only while that location is selected, so an
 * admin who narrows hours and navigates away never sees the panel again. This is the standing
 * reminder, and it is a control rather than a tile because a count you cannot act on just moves
 * the hunt to a different screen.
 *
 * Renders nothing at zero: an all-clear shown every day trains the eye to skip the row this
 * needs to be noticed in.
 *
 * The link carries the location, because the locations screen remembers the last one selected and
 * would otherwise open on a location with nothing wrong with it — a control that lands you
 * somewhere reporting an all-clear reads as a broken count rather than a wrong destination.
 *
 * @see [ScheduleConflictsBanner.test.tsx](../../../tests/components/admin/dashboard/ScheduleConflictsBanner.test.tsx)
 * — pins that it stays silent at zero and links to the first location that has conflicts.
 */
export function ScheduleConflictsBanner({
  count,
  locationIds,
}: {
  count: number;
  /** The locations the conflicts sit on; the first is where the link lands. */
  locationIds: number[];
}) {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();

  if (count <= 0) return null;

  const target: Href =
    locationIds.length > 0
      ? { pathname: "/admin/locations", params: { location: String(locationIds[0]) } }
      : "/admin/locations";

  return (
    <Pressable
      testID="dashboard-schedule-conflicts"
      accessibilityRole="button"
      accessibilityLabel={t("admin.dashboard.scheduleConflicts.accessibilityLabel", { count })}
      onPress={() => router.push(target)}
      style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.warning }]}
    >
      <View style={[styles.icon, { backgroundColor: `${colors.warning}1f` }]}>
        <Icon name="alert-circle-outline" size="xl" color={colors.warning} />
      </View>
      <View style={styles.copy}>
        <ThemedText style={styles.title}>
          {t("admin.dashboard.scheduleConflicts.title", { count })}
        </ThemedText>
        <ThemedText style={[styles.sub, { color: colors.muted }]}>
          {t("admin.dashboard.scheduleConflicts.subtitle")}
        </ThemedText>
      </View>
      <Icon name="chevron-forward" size="md" color={colors.muted} />
    </Pressable>
  );
}
