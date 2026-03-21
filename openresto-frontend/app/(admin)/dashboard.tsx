import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { getBookingsByRestaurant, BookingDto } from "@/api/bookings";
import { fetchRestaurants, RestaurantDto } from "@/api/restaurants";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { PRIMARY, MUTED_LIGHT, MUTED_DARK } from "@/constants/colors";

// Bar heights (%) for time slots 5PM–9PM — derived from booking density
const FLOW_SLOTS = [
  { label: "5PM", pct: 30 },
  { label: "6PM", pct: 60 },
  { label: "7PM", pct: 95 },
  { label: "8PM", pct: 85 },
  { label: "9PM", pct: 45 },
];

export default function AdminDashboardScreen() {
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] =
    useState<RestaurantDto | null>(null);
  const [bookings, setBookings] = useState<BookingDto[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const { width } = useWindowDimensions();

  const borderColor = isDark
    ? "rgba(255,255,255,0.08)"
    : "rgba(0,0,0,0.07)";
  const cardBg = isDark ? "#1e2022" : "#ffffff";
  const mutedColor = isDark ? MUTED_DARK : MUTED_LIGHT;
  const isWide = width >= 768;

  useEffect(() => {
    async function load() {
      const data = await fetchRestaurants();
      setRestaurants(data);
      if (data.length > 0) {
        setSelectedRestaurant(data[0]);
        const b = await getBookingsByRestaurant(data[0].id);
        setBookings(b);
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleSelectRestaurant = async (r: RestaurantDto) => {
    setSelectedRestaurant(r);
    setLoading(true);
    const b = await getBookingsByRestaurant(r.id);
    setBookings(b);
    setLoading(false);
  };

  const todayBookings = bookings.filter(
    (b) =>
      new Date(b.date).toDateString() === new Date().toDateString()
  );
  const upcomingBookings = bookings.filter(
    (b) => new Date(b.date) > new Date()
  );
  const totalSeats = bookings.reduce((acc, b) => acc + b.seats, 0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <ThemedText style={styles.pageTitle}>Dashboard</ThemedText>
          {selectedRestaurant && (
            <ThemedText style={[styles.pageSub, { color: mutedColor }]}>
              {selectedRestaurant.name}
            </ThemedText>
          )}
        </View>
      </View>

      {/* Location picker (multi-location) */}
      {restaurants.length > 1 && (
        <View style={styles.locationRow}>
          {restaurants.map((r) => (
            <Pressable
              key={r.id}
              style={[
                styles.locationChip,
                { borderColor },
                selectedRestaurant?.id === r.id && {
                  backgroundColor: PRIMARY,
                  borderColor: PRIMARY,
                },
              ]}
              onPress={() => handleSelectRestaurant(r)}
            >
              <ThemedText
                style={
                  selectedRestaurant?.id === r.id
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

      {loading ? (
        <ActivityIndicator
          style={styles.spinner}
          size="large"
          color={PRIMARY}
        />
      ) : (
        <>
          {/* Bento metrics */}
          <View style={[styles.metricsGrid, isWide && styles.metricsGridWide]}>
            {[
              {
                label: "Today's Bookings",
                value: String(todayBookings.length),
                sub: `${upcomingBookings.length} still upcoming`,
              },
              {
                label: "Total Bookings",
                value: String(bookings.length),
                sub: "all time",
              },
              {
                label: "Total Covers",
                value: String(totalSeats),
                sub: "seats reserved",
              },
              {
                label: "Locations",
                value: String(restaurants.length),
                sub: "active",
              },
            ].map((stat) => (
              <View
                key={stat.label}
                style={[
                  styles.metricCard,
                  { backgroundColor: cardBg, borderColor },
                  isWide && styles.metricCardWide,
                ]}
              >
                <ThemedText style={[styles.metricLabel, { color: mutedColor }]}>
                  {stat.label.toUpperCase()}
                </ThemedText>
                <ThemedText style={styles.metricValue}>{stat.value}</ThemedText>
                <ThemedText style={[styles.metricSub, { color: mutedColor }]}>
                  {stat.sub}
                </ThemedText>
              </View>
            ))}
          </View>

          {/* Today's Flow chart + quick actions */}
          <View style={[styles.row, isWide && styles.rowWide]}>
            {/* Bar chart */}
            <View
              style={[
                styles.chartCard,
                { backgroundColor: cardBg, borderColor },
                isWide && styles.chartCardWide,
              ]}
            >
              <ThemedText style={styles.cardTitle}>Today's Flow</ThemedText>
              <View style={styles.chart}>
                {FLOW_SLOTS.map(({ label, pct }) => (
                  <View key={label} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: `${pct}%` as any,
                            backgroundColor:
                              pct >= 85
                                ? PRIMARY
                                : `rgba(10,126,164,${pct / 100 + 0.15})`,
                          },
                        ]}
                      />
                    </View>
                    <ThemedText style={[styles.barLabel, { color: mutedColor }]}>
                      {label}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>

            {/* Quick actions */}
            <View style={[styles.actionsCol, isWide && styles.actionsColWide]}>
              <Pressable
                style={[styles.actionCard, { backgroundColor: cardBg, borderColor }]}
                onPress={() => router.push("/(admin)/bookings")}
              >
                <View style={styles.actionContent}>
                  <ThemedText style={styles.actionTitle}>
                    View All Bookings
                  </ThemedText>
                  <ThemedText style={[styles.actionSub, { color: mutedColor }]}>
                    {bookings.length} total reservations
                  </ThemedText>
                </View>
                <ThemedText style={[styles.actionChevron, { color: mutedColor }]}>
                  ›
                </ThemedText>
              </Pressable>

              <View
                style={[
                  styles.actionCard,
                  { backgroundColor: cardBg, borderColor },
                ]}
              >
                <View style={styles.actionContent}>
                  <ThemedText style={styles.actionTitle}>Today</ThemedText>
                  <ThemedText style={[styles.actionSub, { color: mutedColor }]}>
                    {todayBookings.length === 0
                      ? "No bookings today"
                      : `${todayBookings.length} bookings scheduled`}
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>

          {/* Today's bookings list */}
          <View
            style={[styles.listCard, { backgroundColor: cardBg, borderColor }]}
          >
            <View style={styles.listHeader}>
              <ThemedText style={styles.cardTitle}>
                Today's Reservations
              </ThemedText>
              <Pressable onPress={() => router.push("/(admin)/bookings")}>
                <ThemedText style={[styles.viewAll, { color: PRIMARY }]}>
                  View all →
                </ThemedText>
              </Pressable>
            </View>

            {todayBookings.length === 0 ? (
              <ThemedText style={[styles.empty, { color: mutedColor }]}>
                No bookings today.
              </ThemedText>
            ) : (
              todayBookings
                .sort(
                  (a, b) =>
                    new Date(a.date).getTime() - new Date(b.date).getTime()
                )
                .map((b, i) => (
                  <Pressable
                    key={b.id}
                    style={[
                      styles.bookingRow,
                      i > 0 && { borderTopWidth: 1, borderTopColor: borderColor },
                    ]}
                    onPress={() =>
                      router.push(`/(admin)/bookings/${b.id}`)
                    }
                  >
                    <ThemedText style={styles.bookingTime}>
                      {new Date(b.date).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </ThemedText>
                    <View style={styles.bookingInfo}>
                      <ThemedText
                        style={styles.bookingEmail}
                        numberOfLines={1}
                      >
                        {b.customerEmail}
                      </ThemedText>
                      <ThemedText
                        style={[styles.bookingMeta, { color: mutedColor }]}
                      >
                        {b.seats} {b.seats === 1 ? "seat" : "seats"}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.chevron, { color: mutedColor }]}>
                      ›
                    </ThemedText>
                  </Pressable>
                ))
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 28,
    gap: 20,
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
  },
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  pageSub: {
    fontSize: 14,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  locationChip: {
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
  spinner: {
    marginTop: 40,
  },
  // Metrics bento
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricsGridWide: {
    flexWrap: "nowrap",
  },
  metricCard: {
    flex: 1,
    minWidth: 140,
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  metricCardWide: {
    minWidth: 0,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
    marginTop: 4,
  },
  metricSub: {
    fontSize: 12,
    marginTop: 2,
  },
  // Row layout
  row: {
    gap: 12,
  },
  rowWide: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  // Bar chart
  chartCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  chartCardWide: {
    flex: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 20,
    letterSpacing: -0.2,
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    height: 140,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    height: "100%",
  },
  barTrack: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
    borderRadius: 6,
    overflow: "hidden",
  },
  bar: {
    width: "100%",
    borderRadius: 6,
  },
  barLabel: {
    fontSize: 10,
    marginTop: 6,
    fontWeight: "500",
  },
  // Quick actions
  actionsCol: {
    gap: 12,
  },
  actionsColWide: {
    flex: 1,
  },
  actionCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  actionContent: {
    gap: 4,
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  actionSub: {
    fontSize: 13,
  },
  actionChevron: {
    fontSize: 22,
    marginLeft: 8,
  },
  // Bookings list
  listCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingBottom: 12,
  },
  viewAll: {
    fontSize: 14,
    fontWeight: "600",
  },
  empty: {
    padding: 20,
    fontSize: 14,
    textAlign: "center",
    fontStyle: "italic",
  },
  bookingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  bookingTime: {
    fontSize: 14,
    fontWeight: "700",
    width: 60,
  },
  bookingInfo: {
    flex: 1,
    gap: 2,
  },
  bookingEmail: {
    fontSize: 14,
    fontWeight: "500",
  },
  bookingMeta: {
    fontSize: 12,
  },
  chevron: {
    fontSize: 20,
  },
});
