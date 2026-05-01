import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
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
import { getAdminDashboardStats, AdminDashboardStats, BookingSummaryDto } from "@/api/admin";
import { useAppTheme } from "@/hooks/use-app-theme";
import { ThemeColors } from "@/theme/theme";

export default function AdminDashboardScreen() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors, primaryColor, isDark } = useAppTheme();

  const isWide = Platform.OS === "web" && width >= 1024;

  useEffect(() => {
    getAdminDashboardStats().then((data: AdminDashboardStats | null) => {
      setStats(data);
      setLoading(false);
    });
  }, []);

  const metricCards = stats
    ? [
        {
          label: "Today's Bookings",
          value: stats.todayCount,
          sub: "Total covers for today",
          icon: "calendar-outline" as const,
          accent: "#2563eb",
        },
        {
          label: "Active Holds",
          value: stats.activeHoldsCount,
          sub: "Tables currently being held",
          icon: "book-outline" as const,
          accent: primaryColor,
        },
        {
          label: "Weekly Trend",
          value: stats.weeklyTrend > 0 ? `+${stats.weeklyTrend}%` : `${stats.weeklyTrend}%`,
          sub: "Vs. previous 7 days",
          icon: "trending-up-outline" as const,
          accent: "#16a34a",
        },
        {
          label: "Total Covers",
          value: stats.totalCovers.toLocaleString(),
          sub: "Total guests served (all time)",
          icon: "people-outline" as const,
          accent: "#d97706",
        },
      ]
    : [];

  const QUICK_ACTIONS = [
    {
      title: "New Booking",
      icon: "person-add-outline" as const,
      route: "/(admin)/bookings/new" as const,
      primary: true,
    },
    {
      title: "View All Bookings",
      icon: "list-outline" as const,
      route: "/(admin)/bookings" as const,
    },
    {
      title: "Manage Settings",
      icon: "settings-outline" as const,
      route: "/(admin)/settings" as const,
    },
  ];

  return (
    <ThemedView style={styles.root}>
      {Platform.OS !== "web" && <Stack.Screen options={{ title: "Admin Dashboard" }} />}
      <ScrollView contentContainerStyle={styles.outer} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View>
            <ThemedText style={styles.pageTitle}>Dashboard</ThemedText>
            <ThemedText style={StyleSheet.flatten([styles.pageSub, { color: colors.muted }])}>
              Welcome back. Here is what&apos;s happening today.
            </ThemedText>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator style={styles.spinner} size="large" color={primaryColor} />
        ) : (
          <>
            <View
              style={StyleSheet.flatten([styles.metricsGrid, isWide && styles.metricsGridWide])}
            >
              {metricCards.map((stat) => (
                <MetricCard key={stat.label} stat={stat} colors={colors} />
              ))}
            </View>

            <View style={StyleSheet.flatten([styles.mainRow, isWide && styles.mainRowWide])}>
              <View
                style={StyleSheet.flatten([
                  styles.chartCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  isWide && styles.chartCardWide,
                ])}
              >
                <View style={styles.chartHeader}>
                  <ThemedText style={styles.cardTitle}>Occupancy Overview</ThemedText>
                  <ThemedText
                    style={StyleSheet.flatten([styles.chartSub, { color: colors.muted }])}
                  >
                    Last 7 days
                  </ThemedText>
                </View>
                <OccupancyChart
                  primaryColor={primaryColor}
                  colors={colors}
                  isDark={isDark}
                  data={stats?.occupancyData ?? []}
                />
              </View>

              <View
                style={StyleSheet.flatten([styles.actionsCol, isWide && styles.actionsColWide])}
              >
                {QUICK_ACTIONS.map((action) => (
                  <Pressable
                    key={action.title}
                    onPress={() => router.push(action.route)}
                    style={({ hovered }) =>
                      StyleSheet.flatten([
                        styles.actionCard,
                        { backgroundColor: colors.card, borderColor: colors.border },
                        action.primary && {
                          backgroundColor: primaryColor,
                          borderColor: primaryColor,
                        },
                        hovered && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                      ])
                    }
                  >
                    <Ionicons
                      name={action.icon}
                      size={24}
                      color={action.primary ? "#fff" : primaryColor}
                    />
                    <ThemedText
                      style={StyleSheet.flatten([
                        styles.actionTitle,
                        action.primary && { color: "#fff" },
                      ])}
                    >
                      {action.title}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View
              style={StyleSheet.flatten([
                styles.listCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ])}
            >
              <View style={styles.listHeader}>
                <ThemedText style={styles.cardTitle}>Today&apos;s Bookings</ThemedText>
                <Pressable onPress={() => router.push("/(admin)/bookings")}>
                  <ThemedText style={StyleSheet.flatten([styles.viewAll, { color: primaryColor }])}>
                    View all →
                  </ThemedText>
                </Pressable>
              </View>
              {stats?.recentBookings.length === 0 ? (
                <View style={styles.emptyRecent}>
                  <ThemedText
                    style={StyleSheet.flatten([styles.emptyText, { color: colors.muted }])}
                  >
                    No bookings for today yet.
                  </ThemedText>
                </View>
              ) : (
                stats?.recentBookings.map((b: BookingSummaryDto) => (
                  <BookingItem key={b.bookingRef} booking={b} colors={colors} router={router} />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function MetricCard({
  stat,
  colors,
}: {
  stat: {
    label: string;
    value: string | number;
    sub: string;
    icon: keyof typeof Ionicons.glyphMap;
    accent: string;
  };
  colors: ThemeColors;
}) {
  return (
    <View
      style={StyleSheet.flatten([
        styles.metricCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ])}
    >
      <View
        style={StyleSheet.flatten([styles.metricIconWrap, { backgroundColor: `${stat.accent}14` }])}
      >
        <Ionicons name={stat.icon} size={20} color={stat.accent} />
      </View>
      <ThemedText style={styles.metricValue}>{stat.value}</ThemedText>
      <ThemedText style={StyleSheet.flatten([styles.metricLabel, { color: colors.muted }])}>
        {stat.label}
      </ThemedText>
      <ThemedText style={StyleSheet.flatten([styles.metricSub, { color: colors.muted }])}>
        {stat.sub}
      </ThemedText>
    </View>
  );
}

function OccupancyChart({
  primaryColor,
  colors,
  isDark,
  data,
}: {
  primaryColor: string;
  colors: ThemeColors;
  isDark: boolean;
  data: number[];
}) {
  const chartData = data?.length > 0 ? data : [0, 0, 0, 0, 0, 0, 0];
  return (
    <View style={styles.chartArea}>
      <View style={styles.chartBars}>
        {chartData.map((val, i) => (
          <View key={i} style={styles.barContainer}>
            <View style={styles.barTrack}>
              <View
                style={StyleSheet.flatten([
                  styles.barFill,
                  {
                    backgroundColor: isDark ? `${primaryColor}CC` : primaryColor,
                    height: `${Math.max(2, val)}%` as `${number}%`,
                  },
                ])}
              />
            </View>
            <ThemedText style={StyleSheet.flatten([styles.barLabel, { color: colors.muted }])}>
              {["T-6", "T-5", "T-4", "T-3", "T-2", "T-1", "Today"][i]}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

function BookingItem({
  booking,
  colors,
  router,
}: {
  booking: BookingSummaryDto;
  colors: ThemeColors;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <Pressable
      onPress={() => router.push(`/(admin)/bookings/${booking.id}`)}
      style={({ hovered }) =>
        StyleSheet.flatten([
          styles.bookingItem,
          { borderTopColor: colors.border },
          hovered && { backgroundColor: `${colors.muted}08` },
        ])
      }
    >
      <View
        style={StyleSheet.flatten([styles.bookingTime, { backgroundColor: `${colors.success}10` }])}
      >
        <ThemedText style={StyleSheet.flatten([styles.bookingTimeText, { color: colors.success }])}>
          {new Date(booking.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </ThemedText>
      </View>
      <View style={styles.bookingInfo}>
        <ThemedText style={styles.bookingEmail} numberOfLines={1}>
          {booking.customerEmail}
        </ThemedText>
        <ThemedText style={StyleSheet.flatten([styles.bookingMeta, { color: colors.muted }])}>
          {booking.seats} guests · {booking.restaurantName}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  outer: { padding: 24, paddingBottom: 60, maxWidth: 1200, width: "100%", alignSelf: "center" },
  header: { marginBottom: 32 },
  pageTitle: { fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  pageSub: { fontSize: 16, marginTop: 4 },
  spinner: { marginTop: 100 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, marginBottom: 24 },
  metricsGridWide: { flexWrap: "nowrap" },
  metricCard: { flex: 1, minWidth: 200, padding: 20, borderRadius: 16, borderWidth: 1 },
  metricIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  metricValue: { fontSize: 24, fontWeight: "800", marginBottom: 4 },
  metricLabel: { fontSize: 14, fontWeight: "600" },
  metricSub: { fontSize: 12, marginTop: 2 },
  mainRow: { flexDirection: "column", gap: 24, marginBottom: 24 },
  mainRowWide: { flexDirection: "row" },
  chartCard: { flex: 2, borderRadius: 16, borderWidth: 1, padding: 24 },
  chartCardWide: { minHeight: 400 },
  chartHeader: { marginBottom: 32 },
  cardTitle: { fontSize: 18, fontWeight: "700" },
  chartSub: { fontSize: 14, marginTop: 4 },
  chartArea: { flex: 1, justifyContent: "flex-end", minHeight: 200 },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12,
    height: 200,
  },
  barContainer: { flex: 1, alignItems: "center", gap: 8 },
  barTrack: {
    width: "100%",
    height: 160,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: 6,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: { width: "100%", borderRadius: 4 },
  barLabel: { fontSize: 12, fontWeight: "600" },
  actionsCol: { flex: 1, gap: 16 },
  actionsColWide: { maxWidth: 300 },
  actionCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  actionTitle: { fontSize: 15, fontWeight: "700" },
  listCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  listHeader: {
    padding: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  viewAll: { fontSize: 14, fontWeight: "600" },
  emptyRecent: { padding: 40, alignItems: "center" },
  emptyText: { fontStyle: "italic" },
  bookingItem: {
    padding: 16,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  bookingTime: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  bookingTimeText: { fontSize: 14, fontWeight: "700" },
  bookingInfo: { flex: 1, gap: 2 },
  bookingEmail: { fontSize: 14, fontWeight: "500" },
  bookingMeta: { fontSize: 12 },
});
