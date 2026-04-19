import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  Platform,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { COLORS, BUTTON_SIZES, getThemeColors } from "@/theme/theme";
import {
  getAdminBookings,
  BookingDetailDto,
  getAdminOverview,
  AdminOverviewDto,
} from "@/api/admin";
import { fetchRestaurants, RestaurantDto } from "@/api/restaurants";
import { hexToRgba } from "@/utils/colors";
import { useBrand } from "@/context/BrandContext";

function toUTCDateString(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const QUICK_ACTIONS = [
  {
    icon: "person-add-outline" as const,
    title: "Add Walk-in",
    sub: "Create an instant booking",
    primary: true,
    route: "/(admin)/bookings/new" as const,
  },
  {
    icon: "list-outline" as const,
    title: "View Bookings",
    sub: "See all bookings",
    primary: false,
    route: "/(admin)/bookings" as const,
  },
  {
    icon: "settings-outline" as const,
    title: "Settings",
    sub: "Manage locations & tables",
    primary: false,
    route: "/(admin)/settings" as const,
  },
];

export default function AdminDashboardScreen() {
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<RestaurantDto | null>(null);
  const [bookings, setBookings] = useState<BookingDetailDto[]>([]);
  const [overview, setOverview] = useState<AdminOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const { width } = useWindowDimensions();
  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;

  const colors = getThemeColors(isDark);
  const borderColor = colors.border;
  const cardBg = colors.card;
  const mutedColor = colors.muted;
  const isWide = width >= 768;
  const subtleBg = isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [data, ov] = await Promise.all([fetchRestaurants(), getAdminOverview()]);
      if (cancelled) return;
      setRestaurants(data);
      setOverview(ov);
      if (data.length > 0) {
        setSelectedRestaurant(data[0]);
        const b = await getAdminBookings(data[0].id);
        if (cancelled) return;
        setBookings(b);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectRestaurant = async (r: RestaurantDto) => {
    setSelectedRestaurant(r);
    setLoading(true);
    const b = await getAdminBookings(r.id);
    setBookings(b);
    setLoading(false);
  };
  const todayDateString = toUTCDateString(new Date());

  const todayBookings = bookings.filter(
    (b) => toUTCDateString(new Date(b.date)) === todayDateString
  );
  const upcomingTodayCount = todayBookings.filter((b) => new Date(b.date) > new Date()).length;

  const flowData = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22].map((hour) => {
    const totalSeats = todayBookings
      .filter((b) => {
        const d = new Date(b.date);
        return d.getHours() === hour;
      })
      .reduce((sum, b) => sum + b.seats, 0);
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const ampm = hour >= 12 ? "PM" : "AM";
    return {
      label: `${displayHour}${ampm}`,
      seats: totalSeats,
    };
  });
  const maxSeats = Math.max(...flowData.map((d) => d.seats), 10);
  const flowSlots = flowData.map((d) => ({
    label: d.label,
    pct: (d.seats / maxSeats) * 100,
  }));

  const stats = [
    {
      label: "Today's Bookings",
      value: String(overview?.todayBookings ?? todayBookings.length),
      sub: `${upcomingTodayCount} still upcoming`,
      icon: "calendar-outline" as const,
      accent: primaryColor,
    },
    {
      label: "Total Bookings",
      value: String(overview?.totalBookings ?? bookings.length),
      sub: "all time",
      icon: "book-outline" as const,
      accent: primaryColor,
    },
    {
      label: "Total Covers",
      value: String(overview?.totalSeats ?? 0),
      sub: "seats reserved",
      icon: "people-outline" as const,
      accent: primaryColor,
    },
    {
      label: "Locations",
      value: String(overview?.totalRestaurants ?? restaurants.length),
      sub: "active",
      icon: "location-outline" as const,
      accent: primaryColor,
    },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {Platform.OS !== "web" && <Stack.Screen options={{ title: "Dashboard" }} />}
      <View style={styles.pageHeader}>
        <View>
          <ThemedText style={styles.pageTitle}>Dashboard</ThemedText>
          {selectedRestaurant && (
            <ThemedText style={[styles.pageSub, { color: mutedColor }]}>
              {selectedRestaurant.name}
            </ThemedText>
          )}
        </View>
        {restaurants.length > 1 && (
          <View style={styles.locationRow}>
            {restaurants.map((r) => (
              <Pressable
                key={r.id}
                style={[
                  styles.locationChip,
                  { borderColor },
                  selectedRestaurant?.id === r.id && {
                    backgroundColor: primaryColor,
                    borderColor: primaryColor,
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
      </View>

      {loading ? (
        <ActivityIndicator style={styles.spinner} size="large" color={primaryColor} />
      ) : (
        <>
          <View style={[styles.metricsGrid, isWide && styles.metricsGridWide]}>
            {stats.map((stat) => (
              <View
                key={stat.label}
                style={[
                  styles.metricCard,
                  { backgroundColor: cardBg, borderColor },
                  isWide && styles.metricCardWide,
                ]}
              >
                <View style={[styles.metricIconWrap, { backgroundColor: `${stat.accent}14` }]}>
                  <Ionicons name={stat.icon} size={18} color={stat.accent} />
                </View>
                <ThemedText style={styles.metricValue}>{stat.value}</ThemedText>
                <ThemedText style={[styles.metricLabel, { color: mutedColor }]}>
                  {stat.label}
                </ThemedText>
                <ThemedText style={[styles.metricSub, { color: mutedColor }]}>
                  {stat.sub}
                </ThemedText>
              </View>
            ))}
          </View>

          <View style={[styles.mainRow, isWide && styles.mainRowWide]}>
            <View
              style={[
                styles.chartCard,
                { backgroundColor: cardBg, borderColor },
                isWide && styles.chartCardWide,
              ]}
            >
              <View style={styles.chartHeader}>
                <ThemedText style={styles.cardTitle}>Today's Flow</ThemedText>
                <ThemedText style={[styles.chartSub, { color: mutedColor }]}>
                  Booking density by hour
                </ThemedText>
              </View>
              <View style={styles.chart}>
                {flowSlots.map(({ label, pct }) => (
                  <View key={label} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: `${pct}%` as const,
                            backgroundColor:
                              pct >= 85
                                ? primaryColor
                                : hexToRgba(primaryColor, (pct / 100) * 0.7 + 0.15),
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

            <View style={[styles.actionsCol, isWide && styles.actionsColWide]}>
              {QUICK_ACTIONS.map((action) => (
                <Pressable
                  key={action.title}
                  onPress={() => router.push(action.route)}
                  style={(state) => [
                    styles.actionCard,
                    { backgroundColor: cardBg, borderColor, cursor: "pointer" } as const,
                    action.primary && {
                      backgroundColor: primaryColor,
                      borderColor: primaryColor,
                    },
                    !action.primary &&
                      (state as { hovered?: boolean }).hovered && {
                        backgroundColor: subtleBg,
                      },
                  ]}
                >
                  <View
                    style={[
                      styles.actionIconWrap,
                      {
                        backgroundColor: action.primary
                          ? "rgba(255,255,255,0.18)"
                          : hexToRgba(primaryColor, 0.08),
                      },
                    ]}
                  >
                    <Ionicons
                      name={action.icon}
                      size={18}
                      color={action.primary ? "#fff" : primaryColor}
                    />
                  </View>
                  <View style={styles.actionText}>
                    <ThemedText style={[styles.actionTitle, action.primary && { color: "#fff" }]}>
                      {action.title}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.actionSub,
                        { color: action.primary ? "rgba(255,255,255,0.75)" : colors.muted },
                      ]}
                    >
                      {action.sub}
                    </ThemedText>
                  </View>
                  <Ionicons
                    name="chevron-forward-outline"
                    size={16}
                    color={action.primary ? "rgba(255,255,255,0.8)" : colors.muted}
                  />
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.listCard, { backgroundColor: cardBg, borderColor }]}>
            <View style={styles.listHeader}>
              <ThemedText style={styles.cardTitle}>Today's Bookings</ThemedText>
              <Pressable onPress={() => router.push("/(admin)/bookings")}>
                <ThemedText style={[styles.viewAll, { color: primaryColor }]}>
                  View all →
                </ThemedText>
              </Pressable>
            </View>

            {todayBookings.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={32} color={mutedColor} />
                <ThemedText style={[styles.emptyText, { color: mutedColor }]}>
                  No bookings today
                </ThemedText>
              </View>
            ) : (
              todayBookings
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((b, i) => (
                  <Pressable
                    key={b.id}
                    style={[
                      styles.bookingRow,
                      i > 0 && {
                        borderTopWidth: 1,
                        borderTopColor: borderColor,
                      },
                    ]}
                    onPress={() => router.push(`/(admin)/bookings/${b.id}`)}
                  >
                    <View style={styles.bookingTime}>
                      <ThemedText style={styles.bookingTimeText}>
                        {new Date(b.date).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </ThemedText>
                    </View>
                    <View style={styles.bookingInfo}>
                      <ThemedText style={styles.bookingEmail} numberOfLines={1}>
                        {b.customerEmail}
                      </ThemedText>
                      <ThemedText style={[styles.bookingMeta, { color: mutedColor }]}>
                        {b.seats} {b.seats === 1 ? "guest" : "guests"}
                      </ThemedText>
                    </View>
                    <Ionicons name="chevron-forward-outline" size={16} color={mutedColor} />
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
    padding: 24,
    paddingTop: 32,
    gap: 20,
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
  },
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 12,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.6,
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
  chipText: { fontSize: 13 },
  chipTextActive: { color: "#fff", fontWeight: "600", fontSize: 13 },
  spinner: { marginTop: 40 },
  // Metrics
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricsGridWide: { flexWrap: "nowrap" },
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
  metricCardWide: { minWidth: 0 },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginTop: 2,
  },
  metricSub: {
    fontSize: 12,
  },
  // Main row (chart + actions)
  mainRow: { gap: 16 },
  mainRowWide: {
    flexDirection: "row",
    alignItems: "stretch",
  },
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
  chartCardWide: { flex: 2 },
  chartHeader: { marginBottom: 20 },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  chartSub: {
    fontSize: 12,
    marginTop: 2,
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
  sectionHeading: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  actionsCol: { gap: 10 },
  actionsColWide: { flex: 1, justifyContent: "space-between" },
  actionCard: {
    borderRadius: 12,
    borderWidth: 1,
    ...BUTTON_SIZES.secondary,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  actionIconWrap: {
    ...BUTTON_SIZES.icon,
    borderRadius: 10,
  },
  actionText: { flex: 1, gap: 2 },
  actionTitle: { fontSize: 15, fontWeight: "700" },
  actionSub: { fontSize: 13 },
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
  viewAll: { fontSize: 14, fontWeight: "600" },
  emptyState: {
    alignItems: "center",
    paddingVertical: 36,
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
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
    width: 68,
  },
  bookingTimeText: {
    fontSize: 14,
    fontWeight: "700",
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
});
