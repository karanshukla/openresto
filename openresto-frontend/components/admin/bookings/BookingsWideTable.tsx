import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { BookingDetailDto } from "@/api/admin";
import { theme } from "@/theme/theme";
import { initials } from "@/utils/formatters";
import { isPast, StatusBadge } from "@/components/admin/bookings/StatusBadge";
import { styles } from "@/components/admin/bookings/bookings.styles";
import { focusedRowHighlight, rowA11yProps } from "@/components/admin/bookings/bookingRowProps";

export interface BookingsWideTableProps {
  bookings: BookingDetailDto[];
  focusedRowId: number | null;
  onOpenBooking: (id: number) => void;
  onCancelBooking: (booking: BookingDetailDto) => void;
  /** Theme values passed from the orchestrating screen (presentational). */
  borderColor: string;
  cardBg: string;
  mutedColor: string;
  isDark: boolean;
  primaryColor: string;
}

/**
 * Wide (desktop/tablet) bookings list — a bordered table with one row per
 * booking. Extracted from the bookings screen for decomposition; presentational,
 * owns no state (the screen drives focus + open/cancel callbacks).
 */
export function BookingsWideTable({
  bookings,
  focusedRowId,
  onOpenBooking,
  onCancelBooking,
  borderColor,
  cardBg,
  mutedColor,
  isDark,
  primaryColor,
}: BookingsWideTableProps) {
  return (
    <View style={[styles.tableCard, { backgroundColor: cardBg, borderColor }]}>
      <View style={[styles.tableHeader, { backgroundColor: isDark ? "#28292b" : "#f8f8f9" }]}>
        <ThemedText style={[styles.thCell, styles.colTime, { color: mutedColor }]}>TIME</ThemedText>
        <ThemedText style={[styles.thCell, styles.colGuest, { color: mutedColor }]}>
          GUEST
        </ThemedText>
        <ThemedText style={[styles.thCell, styles.colParty, { color: mutedColor }]}>
          PARTY
        </ThemedText>
        <ThemedText style={[styles.thCell, styles.colTable, { color: mutedColor }]}>
          TABLE
        </ThemedText>
        <ThemedText style={[styles.thCell, styles.colStatus, { color: mutedColor }]}>
          STATUS
        </ThemedText>
        <View style={styles.colAction} />
      </View>

      {bookings.map((b, i) => (
        <Pressable
          key={b.id}
          {...rowA11yProps(b.id, focusedRowId)}
          style={[
            styles.tableRow,
            i > 0 && { borderTopWidth: 1, borderTopColor: borderColor },
            { cursor: "pointer" } as const,
            focusedRowHighlight(b.id, focusedRowId, primaryColor),
          ]}
          onPress={() => onOpenBooking(b.id)}
        >
          {/* Avatar + time */}
          <View style={[styles.colTime, { flexDirection: "row", alignItems: "center", gap: 8 }]}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: `${primaryColor}18`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ThemedText style={{ fontSize: 11, fontWeight: "700", color: primaryColor }}>
                {initials(b.customerName ?? b.customerEmail)}
              </ThemedText>
            </View>
            <View>
              <ThemedText style={styles.tdTime}>
                {new Date(b.date).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </ThemedText>
              <ThemedText style={[styles.tdDate, { color: mutedColor }]}>
                {new Date(b.date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </ThemedText>
            </View>
          </View>

          <View style={styles.colGuest}>
            <ThemedText style={styles.tdGuest} numberOfLines={1}>
              {b.customerName ?? b.customerEmail}
            </ThemedText>
            {b.customerName ? (
              <ThemedText style={[styles.tdNotes, { color: mutedColor }]} numberOfLines={1}>
                {b.customerEmail}
              </ThemedText>
            ) : null}
            {b.bookingRef && (
              <ThemedText style={[styles.tdNotes, { color: mutedColor }]} numberOfLines={1}>
                {b.bookingRef}
              </ThemedText>
            )}
          </View>

          <View style={styles.colParty}>
            <View style={styles.partyPill}>
              <Ionicons name="people-outline" size={12} color={mutedColor} />
              <ThemedText style={[styles.tdParty, { color: mutedColor }]}>{b.seats}</ThemedText>
            </View>
          </View>

          <ThemedText style={[styles.tdTableNum, styles.colTable, { color: mutedColor }]}>
            {b.tableName}
          </ThemedText>

          <View style={styles.colStatus}>
            {b.isCancelled ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: theme.status.cancelled.bg[isDark ? "dark" : "light"] },
                ]}
              >
                <ThemedText style={[styles.badgeText, { color: theme.status.cancelled.text }]}>
                  Cancelled
                </ThemedText>
              </View>
            ) : (
              <StatusBadge date={b.date} isDark={isDark} />
            )}
          </View>

          <View style={styles.colAction}>
            {!b.isCancelled && !isPast(b.date) && (
              <Pressable
                accessibilityLabel="Cancel booking"
                style={[
                  styles.rowActionBtn,
                  { backgroundColor: theme.status.cancelled.bg[isDark ? "dark" : "light"] },
                ]}
                onPress={(e) => {
                  // stopPropagation is present on web mouse events but not RN's
                  // GestureResponderEvent — guard both the event and the method.
                  (e as { stopPropagation?: () => void } | undefined)?.stopPropagation?.();
                  onCancelBooking(b);
                }}
              >
                <Ionicons name="close-outline" size={14} color={theme.status.cancelled.text} />
              </Pressable>
            )}
          </View>
        </Pressable>
      ))}
    </View>
  );
}
