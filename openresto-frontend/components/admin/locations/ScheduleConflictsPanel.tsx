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
import { styles } from "./ScheduleConflictsPanel.styles";

const REASON_LABELS: Record<ScheduleConflictReason, string> = {
  closedDay: "Now a closed day",
  outsideHours: "Now outside opening hours",
  walkInOnly: "Now walk-in only",
};

function formatSitting(dateUtc: string, timezone: string): string {
  return new Date(dateUtc).toLocaleString(undefined, {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Upcoming bookings the location's current schedule would no longer accept.
 *
 * Editing hours, open days or the walk-in policy autosaves and never touches the bookings
 * already taken, so without this the guests an edit strands are invisible until they turn up.
 * Deliberately a report rather than a gate: the admin narrowing hours usually knows they have
 * bookings to move, and blocking the edit would leave them unable to stop taking new ones.
 *
 * @see [ScheduleConflictsPanel.test.tsx](../../../tests/components/admin/locations/ScheduleConflictsPanel.test.tsx)
 * — pins that a failed read stays silent rather than reporting all-clear.
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

  // Null is "could not check", not "all clear" — saying nothing beats a false all-clear.
  if (conflicts === null || conflicts.length === 0) return null;

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
