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
import { BookingDetailPopup } from "@/components/admin/bookings/BookingDetailPopup";
import { StatusBadge } from "@/components/admin/bookings/StatusBadge";
import { useAppTheme } from "@/hooks/use-app-theme";
import { ThemeColors, COLORS, BORDER_RADIUS, SPACING, TYPOGRAPHY } from "@/theme/theme";
import RestaurantActionModal from "@/components/admin/bookings/RestaurantActionModal";
import AlertModal from "@/components/common/AlertModal";

export default function AdminDashboardScreen() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { colors, primaryColor, isDark } = useAppTheme();

  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionType, setActionType] = useState<"pause" | "extend">("pause");
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const isWide = Platform.OS === "web" && width >= 1024;

  const loadStats = () => {
    getAdminDashboardStats().then((data: AdminDashboardStats | null) => {
      setStats(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadStats();
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
          label: "Restaurant Status",
          value: stats.pausedCount > 0 ? "Paused" : "Active",
          sub:
            stats.pausedCount > 0
              ? `${stats.pausedCount} venues are currently paused`
              : "All venues are accepting bookings",
          icon:
            stats.pausedCount > 0
              ? ("pause-circle-outline" as const)
              : ("checkmark-circle-outline" as const),
          accent: stats.pausedCount > 0 ? COLORS.error : COLORS.success,
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
      onPress: () => router.push({ pathname: "/(admin)/bookings", params: { create: "1" } }),
      primary: true,
    },
    {
      title: "View All Bookings",
      icon: "list-outline" as const,
      route: "/(admin)/bookings" as const,
    },
    {
      title: "Pause Bookings",
      icon: "pause-circle-outline" as const,
      onPress: () => {
        setActionType("pause");
        setActionModalVisible(true);
      },
    },
    {
      title: "Extend Bookings",
      icon: "time-outline" as const,
      onPress: () => {
        setActionType("extend");
        setActionModalVisible(true);
      },
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
            <ThemedText type="h1">Dashboard</ThemedText>
            <ThemedText style={[styles.pageSub, { color: colors.muted }]}>
              Welcome back. Here is what&apos;s happening today.
            </ThemedText>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator
            style={styles.spinner}
            size="large"
            color={primaryColor}
            testID="dashboard-spinner"
          />
        ) : (
          <>
            <View style={[styles.metricsGrid, isWide && styles.metricsGridWide]}>
              {metricCards.map((stat) => (
                <MetricCard key={stat.label} stat={stat} colors={colors} />
              ))}
            </View>

            <View style={[styles.mainRow, isWide && styles.mainRowWide]}>
              <View
                style={[
                  styles.chartCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  isWide && styles.chartCardWide,
                ]}
              >
                <View style={styles.chartHeader}>
                  <ThemedText style={styles.cardTitle}>Occupancy Overview</ThemedText>
                  <ThemedText style={[styles.chartSub, { color: colors.muted }]}>
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

              <View style={[styles.actionsCol, isWide && styles.actionsColWide]}>
                {QUICK_ACTIONS.map((action) => (
                  <Pressable
                    key={action.title}
                    onPress={() => (action.route ? router.push(action.route) : action.onPress?.())}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    style={({ hovered }: any) => [
                      styles.actionCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                      action.primary && {
                        backgroundColor: primaryColor,
                        borderColor: primaryColor,
                      },
                      hovered && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Ionicons
                      name={action.icon}
                      size={24}
                      color={action.primary ? COLORS.white : primaryColor}
                    />
                    <ThemedText
                      style={[styles.actionTitle, action.primary && { color: COLORS.white }]}
                    >
                      {action.title}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <View
              style={[
                styles.listCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.listHeader}>
                <ThemedText style={styles.cardTitle}>Today&apos;s Bookings</ThemedText>
                <Pressable onPress={() => router.push("/(admin)/bookings")}>
                  <ThemedText style={[styles.viewAll, { color: primaryColor }]}>
                    View all →
                  </ThemedText>
                </Pressable>
              </View>
              {stats?.recentBookings.length === 0 ? (
                <View style={styles.emptyRecent}>
                  <ThemedText style={[styles.emptyText, { color: colors.muted }]}>
                    No upcoming bookings for today.
                  </ThemedText>
                </View>
              ) : (
                stats?.recentBookings.map((b: BookingSummaryDto) => (
                  <BookingItem
                    key={b.bookingRef}
                    booking={b}
                    colors={colors}
                    isDark={isDark}
                    onPress={() => setSelectedBookingId(b.id)}
                  />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      <RestaurantActionModal
        visible={actionModalVisible}
        actionType={actionType}
        onClose={() => {
          setActionModalVisible(false);
          loadStats();
        }}
        onSuccess={(msg) => {
          setAlertMessage(msg);
          setAlertVisible(true);
        }}
      />

      <AlertModal
        visible={alertVisible}
        title="Success"
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />

      <BookingDetailPopup
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        onMutated={loadStats}
      />
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
    <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.metricIconWrap, { backgroundColor: `${stat.accent}14` }]}>
        <Ionicons name={stat.icon} size={20} color={stat.accent} />
      </View>
      <ThemedText style={styles.metricValue}>{stat.value}</ThemedText>
      <ThemedText style={[styles.metricLabel, { color: colors.muted }]}>{stat.label}</ThemedText>
      <ThemedText style={[styles.metricSub, { color: colors.muted }]}>{stat.sub}</ThemedText>
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
                style={[
                  styles.barFill,
                  {
                    backgroundColor: isDark ? `${primaryColor}CC` : primaryColor,
                    height: `${Math.max(2, val)}%` as `${number}%`,
                  },
                ]}
              />
            </View>
            <ThemedText style={[styles.barLabel, { color: colors.muted }]}>
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
  isDark,
  onPress,
}: {
  booking: BookingSummaryDto;
  colors: ThemeColors;
  isDark: boolean;
  onPress: () => void;
}) {
  const now = new Date();
  const startTime = new Date(booking.date);
  const endTime = booking.endTime
    ? new Date(booking.endTime)
    : new Date(startTime.getTime() + 60 * 60 * 1000);

  const isCancelled = !!booking.isCancelled;
  const isActive = !isCancelled && now >= startTime && now <= endTime;

  const bubbleBg = isCancelled
    ? `${COLORS.error}1a`
    : isActive
      ? `${colors.success}18`
      : `${colors.muted}14`;

  const bubbleTextColor = isCancelled ? COLORS.error : isActive ? colors.success : colors.muted;

  return (
    <Pressable
      onPress={onPress}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style={({ hovered }: any) => [
        styles.bookingItem,
        { borderTopColor: colors.border },
        hovered && { backgroundColor: `${colors.muted}08` },
        isActive && { backgroundColor: `${colors.success}05` },
      ]}
    >
      <View style={[styles.bookingTime, { backgroundColor: bubbleBg }]}>
        <ThemedText style={[styles.bookingTimeText, { color: bubbleTextColor }]}>
          {startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </ThemedText>
      </View>
      <View style={styles.bookingInfo}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ThemedText style={styles.bookingEmail} numberOfLines={1}>
            {booking.customerName ?? booking.customerEmail}
          </ThemedText>
          {isCancelled ? (
            <View style={styles.cancelledBadge}>
              <ThemedText style={styles.cancelledBadgeText}>Cancelled</ThemedText>
            </View>
          ) : (
            <StatusBadge date={booking.date} isDark={isDark} />
          )}
        </View>
        {booking.customerName && (
          <ThemedText style={[styles.bookingMeta, { color: colors.muted }]} numberOfLines={1}>
            {booking.customerEmail}
          </ThemedText>
        )}
        <ThemedText style={[styles.bookingMeta, { color: colors.muted }]}>
          {booking.seats} guests · {booking.restaurantName}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  outer: {
    padding: SPACING.xxl,
    paddingTop: SPACING.xxxl,
    paddingBottom: 60,
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
  },
  header: { marginBottom: SPACING.xxxl },
  pageTitle: { ...TYPOGRAPHY.pageTitle },
  pageSub: { ...TYPOGRAPHY.body, marginTop: SPACING.xs },
  spinner: { marginTop: 100 },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.lg,
    marginBottom: SPACING.xxl,
  },
  metricsGridWide: { flexWrap: "nowrap" },
  metricCard: {
    flex: 1,
    minWidth: 200,
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.card,
    borderWidth: 1,
  },
  metricIconWrap: {
    width: 40,
    height: 40,
    borderRadius: BORDER_RADIUS.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.lg,
  },
  metricValue: { fontSize: 24, fontWeight: "800", marginBottom: SPACING.xs },
  metricLabel: { ...TYPOGRAPHY.label },
  metricSub: { ...TYPOGRAPHY.caption, marginTop: 2 },
  mainRow: { flexDirection: "column", gap: SPACING.xxl, marginBottom: SPACING.xxl },
  mainRowWide: { flexDirection: "row" },
  chartCard: { flex: 2, borderRadius: BORDER_RADIUS.card, borderWidth: 1, padding: SPACING.xxl },
  chartCardWide: { minHeight: 400 },
  chartHeader: { marginBottom: SPACING.xxxl },
  cardTitle: { ...TYPOGRAPHY.h3 },
  chartSub: { ...TYPOGRAPHY.body, marginTop: SPACING.xs },
  chartArea: { flex: 1, justifyContent: "flex-end", minHeight: 200 },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: SPACING.md,
    height: 200,
  },
  barContainer: { flex: 1, alignItems: "center", gap: SPACING.sm },
  barTrack: {
    width: "100%",
    height: 160,
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: BORDER_RADIUS.sm,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: { width: "100%", borderRadius: BORDER_RADIUS.xs },
  barLabel: { ...TYPOGRAPHY.caption, fontWeight: "600" },
  actionsCol: { flex: 1, gap: SPACING.lg },
  actionsColWide: { maxWidth: 300 },
  actionCard: {
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.card,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.lg,
  },
  actionTitle: { ...TYPOGRAPHY.bodyBold },
  listCard: { borderRadius: BORDER_RADIUS.card, borderWidth: 1, overflow: "hidden" },
  listHeader: {
    padding: SPACING.xl,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  viewAll: { ...TYPOGRAPHY.label },
  emptyRecent: { padding: 40, alignItems: "center" },
  emptyText: { fontStyle: "italic" },
  bookingItem: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.lg,
  },
  bookingTime: {
    paddingHorizontal: SPACING.xsm,
    paddingVertical: SPACING.xxs,
    borderRadius: BORDER_RADIUS.md,
  },
  bookingTimeText: { ...TYPOGRAPHY.label, fontWeight: "700" },
  bookingInfo: { flex: 1, gap: 2 },
  bookingEmail: { ...TYPOGRAPHY.label, fontWeight: "500" },
  bookingMeta: { ...TYPOGRAPHY.caption },
  cancelledBadge: {
    backgroundColor: `${COLORS.error}1a`,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  cancelledBadgeText: {
    color: COLORS.error,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});
