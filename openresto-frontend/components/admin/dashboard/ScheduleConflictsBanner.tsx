import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
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
 * @see [ScheduleConflictsBanner.test.tsx](../../../tests/components/admin/dashboard/ScheduleConflictsBanner.test.tsx)
 * — pins that it stays silent at zero and links through to the locations screen.
 */
export function ScheduleConflictsBanner({ count }: { count: number }) {
  const { colors } = useAppTheme();
  const router = useRouter();

  if (count <= 0) return null;

  const bookings = `${count} upcoming booking${count === 1 ? "" : "s"}`;

  return (
    <Pressable
      testID="dashboard-schedule-conflicts"
      accessibilityRole="button"
      accessibilityLabel={`${bookings} no longer fit their location's schedule. Review locations.`}
      onPress={() => router.push("/admin/locations")}
      style={[styles.banner, { backgroundColor: colors.card, borderColor: colors.warning }]}
    >
      <View style={[styles.icon, { backgroundColor: `${colors.warning}1f` }]}>
        <Icon name="alert-circle-outline" size="xl" color={colors.warning} />
      </View>
      <View style={styles.copy}>
        <ThemedText style={styles.title}>
          {bookings} no longer fit their location&apos;s schedule
        </ThemedText>
        <ThemedText style={[styles.sub, { color: colors.muted }]}>
          Taken before the current hours and still on the books. The guests have not been told
          anything changed. Review locations.
        </ThemedText>
      </View>
      <Icon name="chevron-forward" size="md" color={colors.muted} />
    </Pressable>
  );
}
