import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { BookingDetailDto } from "@/api/admin";
import { theme } from "@/theme/theme";
import { StatusBadge } from "@/components/admin/bookings/StatusBadge";
import { styles } from "@/components/admin/bookings/bookings.styles";
import { focusedRowHighlight, rowA11yProps } from "@/components/admin/bookings/bookingRowProps";
import { initials } from "@/utils/formatters";
import { BookingsSortControl } from "@/components/admin/bookings/BookingsSortControl";
import type { SortKey, SortState } from "@/components/admin/bookings/sorting";

export interface BookingsCardListProps {
  bookings: BookingDetailDto[];
  focusedRowId: number | null;
  onOpenBooking: (id: number) => void;
  /** Active sort (drives the control indicator). */
  sort: SortState;
  onSortChange: (key: SortKey) => void;
  /** Theme values passed from the orchestrating screen (presentational). */
  borderColor: string;
  cardBg: string;
  mutedColor: string;
  isDark: boolean;
  primaryColor: string;
}

/**
 * Narrow (mobile) bookings list — one card per booking. Extracted from the
 * bookings screen for decomposition; presentational, owns no state. A
 * `BookingsSortControl` row above the cards provides the sort affordance that
 * the wide table gets via clickable column headers.
 */
export function BookingsCardList({
  bookings,
  focusedRowId,
  onOpenBooking,
  sort,
  onSortChange,
  borderColor,
  cardBg,
  mutedColor,
  isDark,
  primaryColor,
}: BookingsCardListProps) {
  return (
    <View style={styles.cardListWrap}>
      <BookingsSortControl
        sort={sort}
        onSortChange={onSortChange}
        borderColor={borderColor}
        cardBg={cardBg}
        mutedColor={mutedColor}
        primaryColor={primaryColor}
      />
      <View style={styles.cardList}>
        {bookings.map((b) => (
          <Pressable
            key={b.id}
            {...rowA11yProps(b.id, focusedRowId)}
            style={[
              styles.listCard,
              { backgroundColor: cardBg, borderColor },
              focusedRowHighlight(b.id, focusedRowId, primaryColor),
            ]}
            onPress={() => onOpenBooking(b.id)}
          >
            <View style={styles.listCardRow}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: `${primaryColor}18`,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ThemedText style={{ fontSize: 13, fontWeight: "700", color: primaryColor }}>
                  {initials(b.customerName ?? b.customerEmail)}
                </ThemedText>
              </View>
              <View style={styles.listCardInfo}>
                <ThemedText style={styles.tdGuest} numberOfLines={1}>
                  {b.customerName ?? b.customerEmail}
                </ThemedText>
                {b.customerName ? (
                  <ThemedText style={[styles.tdNotes, { color: mutedColor }]} numberOfLines={1}>
                    {b.customerEmail}
                  </ThemedText>
                ) : null}
                <ThemedText style={[styles.tdTime, { fontSize: 13 }]}>
                  {new Date(b.date).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </ThemedText>
                <View style={styles.partyPill}>
                  <Ionicons name="people-outline" size={12} color={mutedColor} />
                  <ThemedText style={[styles.tdDate, { color: mutedColor }]}>
                    {b.seats} guests · {b.tableName}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.listCardRight}>
                {b.isCancelled ? (
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: theme.status.cancelled.bg[isDark ? "dark" : "light"],
                      },
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
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
