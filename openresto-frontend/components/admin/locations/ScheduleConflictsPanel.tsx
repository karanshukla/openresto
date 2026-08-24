import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Icon } from "@/components/common/Icon";
import { RowTextButton } from "@/components/common/RowTextButton";
import { useAppTheme } from "@/hooks/use-app-theme";
import {
  fetchScheduleConflicts,
  ScheduleConflictDto,
  ScheduleConflictReason,
} from "@/api/restaurants";
import { fmtDateTimeInZone } from "@/utils/formatters";
import { styles } from "./ScheduleConflictsPanel.styles";

const REASON_LABELS: Record<ScheduleConflictReason, string> = {
  closedDay: "Now a closed day",
  outsideHours: "Now outside opening hours",
};

function formatSitting(dateUtc: string, timezone: string): string {
  return fmtDateTimeInZone(dateUtc, timezone);
}

/**
 * Upcoming bookings the location's current schedule would no longer accept.
 *
 * Editing hours, open days or the walk-in policy autosaves and never touches the bookings
 * already taken, so without this the guests an edit strands are invisible until they turn up.
 * Deliberately a report rather than a gate: the admin narrowing hours usually knows they have
 * bookings to move, and blocking the edit would leave them unable to stop taking new ones.
 *
 * Three states, not two. Conflicts are listed, none is said out loud, and a failed read stays
 * silent. Collapsing the last two is tempting and wrong in both directions: it would either
 * report an all-clear the read never established, or leave a working panel indistinguishable
 * from a broken one on the locations that need reassuring most.
 *
 * @see [ScheduleConflictsPanel.test.tsx](../../../tests/components/admin/locations/ScheduleConflictsPanel.test.tsx)
 * — pins that a failed read stays silent while an empty one reports all-clear.
 */
export function ScheduleConflictsPanel({
  restaurantId,
  timezone,
  /**
   * Hands the booking to the screen rather than routing to it. The bookings list can only be
   * reached by leaving the location being edited, and it then has to be searched for the ref
   * that was already in hand; the popup opens over the form the conflict came from.
   */
  onOpenBooking,
  /** Bumped by the parent after a save, so the panel re-reads against the new schedule. */
  refreshKey,
  borderColor,
  mutedColor,
  cardBg,
}: {
  restaurantId: number;
  timezone: string;
  onOpenBooking: (bookingId: number) => void;
  refreshKey: number;
  borderColor: string;
  mutedColor: string;
  cardBg: string;
}) {
  const { colors } = useAppTheme();
  const [conflicts, setConflicts] = useState<ScheduleConflictDto[] | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    fetchScheduleConflicts(restaurantId).then((result) => {
      if (!cancelled) setConflicts(result);
    });
    /* istanbul ignore next */
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  useEffect(load, [load, refreshKey]);

  // Null is "could not check", and stays silent: a false all-clear is the one thing worse than
  // saying nothing. An empty list is a real answer, so it gets said out loud — otherwise a
  // working panel and a dead one look identical from the admin's side.
  if (conflicts === null) return null;

  if (conflicts.length === 0) {
    return (
      <View testID="schedule-conflicts-clear" style={styles.clearRow}>
        <Icon name="checkmark-circle-outline" size="sm" color={colors.success} />
        <ThemedText style={[styles.clearText, { color: mutedColor }]}>
          Every upcoming booking fits this schedule.
        </ThemedText>
      </View>
    );
  }

  return (
    <View
      testID="schedule-conflicts-panel"
      style={[styles.card, { backgroundColor: cardBg, borderColor: colors.warning }]}
    >
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: `${colors.warning}1f` }]}>
          <Icon name="alert-circle-outline" size="xl" color={colors.warning} />
        </View>
        <View style={styles.copy}>
          <ThemedText style={styles.title}>
            {conflicts.length} upcoming booking{conflicts.length === 1 ? "" : "s"} no longer fit
            this schedule
          </ThemedText>
          <ThemedText style={[styles.sub, { color: mutedColor }]}>
            These were taken before the current hours and are still on the books. Move or cancel
            them — the guests have not been told anything changed.
          </ThemedText>
        </View>
      </View>

      {conflicts.map((conflict) => (
        <View key={conflict.bookingId} style={[styles.row, { borderTopColor: borderColor }]}>
          <View style={styles.rowCopy}>
            <ThemedText style={styles.rowTitle}>
              {conflict.customerName || conflict.bookingRef} ·{" "}
              {formatSitting(conflict.date, timezone)}
            </ThemedText>
            <ThemedText style={[styles.rowSub, { color: mutedColor }]}>
              {REASON_LABELS[conflict.reason]} · {conflict.seats} guest
              {conflict.seats === 1 ? "" : "s"} · {conflict.bookingRef}
            </ThemedText>
          </View>
          <RowTextButton
            label="Open"
            icon="open-outline"
            color={colors.text}
            accessibilityLabel={`Open booking ${conflict.bookingRef}`}
            onPress={() => onOpenBooking(conflict.bookingId)}
          />
        </View>
      ))}
    </View>
  );
}
