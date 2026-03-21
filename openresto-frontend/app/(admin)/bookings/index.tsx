import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { getBookingsByRestaurant, BookingDto } from "@/api/bookings";
import { fetchRestaurants, RestaurantDto } from "@/api/restaurants";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { PRIMARY, MUTED_LIGHT, MUTED_DARK } from "@/constants/colors";

function statusBadge(date: string): {
  label: string;
  bg: string;
  text: string;
} {
  const d = new Date(date);
  const now = new Date();
  const diffMins = (d.getTime() - now.getTime()) / 60000;

  if (diffMins < -30) return { label: "Completed", bg: "#f1f5f9", text: "#64748b" };
  if (diffMins < 0) return { label: "In Progress", bg: "#dcfce7", text: "#15803d" };
  if (diffMins < 60) return { label: "Upcoming", bg: `rgba(10,126,164,0.08)`, text: PRIMARY };
  return { label: "Scheduled", bg: "#f1f5f9", text: "#64748b" };
}

export default function AdminBookingsScreen() {
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<
    number | null
  >(null);
  const [bookings, setBookings] = useState<BookingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const { width } = useWindowDimensions();

  const borderColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const cardBg = isDark ? "#1e2022" : "#ffffff";
  const headerBg = isDark ? "#28292b" : "#f8f8f9";
  const mutedColor = isDark ? MUTED_DARK : MUTED_LIGHT;
  const isWide = width >= 640;

  useEffect(() => {
    async function load() {
      const data = await fetchRestaurants();
      setRestaurants(data);
      if (data.length > 0) {
        const id = data[0].id;
        setSelectedRestaurantId(id);
        const b = await getBookingsByRestaurant(id);
        setBookings(b);
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleSelectRestaurant = async (id: number) => {
    if (id === selectedRestaurantId) return;
    setSelectedRestaurantId(id);
    setLoading(true);
    const b = await getBookingsByRestaurant(id);
    setBookings(b);
    setLoading(false);
  };

  const sorted = [...bookings].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.pageHeader}>
        <ThemedText style={styles.pageTitle}>Reservations</ThemedText>
        {restaurants.length > 1 && (
          <View style={styles.locationRow}>
            {restaurants.map((r) => (
              <Pressable
                key={r.id}
                style={[
                  styles.chip,
                  { borderColor },
                  r.id === selectedRestaurantId && {
                    backgroundColor: PRIMARY,
                    borderColor: PRIMARY,
                  },
                ]}
                onPress={() => handleSelectRestaurant(r.id)}
              >
                <ThemedText
                  style={
                    r.id === selectedRestaurantId
                      ? styles.chipTextActive
                      : [styles.chipText, { color: mutedColor }]
                  }
                >
                  {r.name}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator
          style={styles.spinner}
          size="large"
          color={PRIMARY}
        />
      ) : sorted.length === 0 ? (
        <ThemedText style={[styles.empty, { color: mutedColor }]}>
          No bookings found.
        </ThemedText>
      ) : isWide ? (
        /* ── Table view (web / wider screens) ── */
        <View
          style={[
            styles.tableCard,
            { backgroundColor: cardBg, borderColor },
          ]}
        >
          {/* Header row */}
          <View style={[styles.tableHeader, { backgroundColor: headerBg }]}>
            <ThemedText style={[styles.thCell, styles.colTime, { color: mutedColor }]}>
              TIME
            </ThemedText>
            <ThemedText style={[styles.thCell, styles.colGuest, { color: mutedColor }]}>
              GUEST
            </ThemedText>
            <ThemedText style={[styles.thCell, styles.colSeats, { color: mutedColor }]}>
              SEATS
            </ThemedText>
            <ThemedText style={[styles.thCell, styles.colStatus, { color: mutedColor }]}>
              STATUS
            </ThemedText>
            <View style={styles.colAction} />
          </View>

          {sorted.map((b, i) => {
            const badge = statusBadge(b.date);
            return (
              <Pressable
                key={b.id}
                style={[
                  styles.tableRow,
                  i > 0 && { borderTopWidth: 1, borderTopColor: borderColor },
                  { cursor: "pointer" } as any,
                ]}
                onPress={() => router.push(`/(admin)/bookings/${b.id}`)}
              >
                <View style={styles.colTime}>
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

                <ThemedText style={[styles.tdGuest, styles.colGuest]} numberOfLines={1}>
                  {b.customerEmail}
                </ThemedText>

                <ThemedText style={[styles.tdSeats, styles.colSeats]}>
                  {b.seats}
                </ThemedText>

                <View style={styles.colStatus}>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: badge.bg },
                    ]}
                  >
                    <ThemedText style={[styles.badgeText, { color: badge.text }]}>
                      {badge.label}
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.colAction}>
                  <ThemedText style={[styles.chevron, { color: mutedColor }]}>
                    ›
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        /* ── Card list (mobile / narrow) ── */
        <View style={styles.cardList}>
          {sorted.map((b, i) => {
            const badge = statusBadge(b.date);
            return (
              <Pressable
                key={b.id}
                style={[
                  styles.listCard,
                  { backgroundColor: cardBg, borderColor },
                ]}
                onPress={() => router.push(`/(admin)/bookings/${b.id}`)}
              >
                <View style={styles.listCardRow}>
                  <View style={styles.listCardInfo}>
                    <ThemedText style={styles.tdTime}>
                      {new Date(b.date).toLocaleString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </ThemedText>
                    <ThemedText
                      style={[styles.tdGuest, { marginTop: 2 }]}
                      numberOfLines={1}
                    >
                      {b.customerEmail}
                    </ThemedText>
                    <ThemedText style={[styles.tdDate, { color: mutedColor, marginTop: 2 }]}>
                      {b.seats} seats
                    </ThemedText>
                  </View>
                  <View style={styles.listCardRight}>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <ThemedText style={[styles.badgeText, { color: badge.text }]}>
                        {badge.label}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.chevron, { color: mutedColor, marginTop: 8 }]}>
                      ›
                    </ThemedText>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 28,
    gap: 16,
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
  },
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  locationRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
  },
  chipTextActive: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  spinner: { marginTop: 40 },
  empty: {
    textAlign: "center",
    marginTop: 40,
    fontStyle: "italic",
    fontSize: 14,
  },
  // Table
  tableCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  thCell: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  colTime: { width: 90 },
  colGuest: { flex: 1, paddingHorizontal: 8 },
  colSeats: { width: 60, textAlign: "center" as any },
  colStatus: { width: 100 },
  colAction: { width: 32, alignItems: "center" },
  tdTime: { fontSize: 14, fontWeight: "700" },
  tdDate: { fontSize: 12, marginTop: 1 },
  tdGuest: { fontSize: 14 },
  tdSeats: { fontSize: 14, fontWeight: "500", textAlign: "center" as any },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: 11, fontWeight: "700" },
  chevron: { fontSize: 20 },
  // Card list (mobile)
  cardList: { gap: 10 },
  listCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  listCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  listCardInfo: { flex: 1, gap: 2 },
  listCardRight: { alignItems: "flex-end" },
});
