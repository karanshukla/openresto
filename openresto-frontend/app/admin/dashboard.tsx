import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  Platform,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { getAdminDashboardStats, AdminDashboardStats, BookingSummaryDto } from "@/api/admin";
import { BookingDetailPopup } from "@/components/admin/bookings/BookingDetailPopup";
import { StatusBadge } from "@/components/admin/bookings/StatusBadge";
import { useAppTheme } from "@/hooks/use-app-theme";
import { theme, ThemeColors } from "@/theme/theme";
import RestaurantActionModal from "@/components/admin/bookings/RestaurantActionModal";
import AlertModal from "@/components/common/AlertModal";
import { styles } from "@/styles/admin/dashboard.styles";
import { Icon, type IconName } from "@/components/common/Icon";
import { ScheduleConflictsBanner } from "@/components/admin/dashboard/ScheduleConflictsBanner";
import { fmtMonthDay, fmtNumber, fmtTime, fmtWeekday } from "@/utils/formatters";

export default function AdminDashboardScreen() {
  const { t } = useTranslation();
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
          label: t("admin.dashboard.metrics.todayBookings.label"),
          value: stats.todayCount,
          sub: t("admin.dashboard.metrics.todayBookings.sub"),
          icon: "calendar-outline" as const,
          accent: "#2563eb",
        },
        {
          label: t("admin.dashboard.metrics.activeHolds.label"),
          value: stats.activeHoldsCount,
          sub: t("admin.dashboard.metrics.activeHolds.sub"),
          icon: "book-outline" as const,
          accent: primaryColor,
        },
        {
          label: t("admin.dashboard.metrics.restaurantStatus.label"),
          value:
            stats.pausedCount > 0
              ? t("admin.dashboard.metrics.restaurantStatus.paused")
              : t("admin.dashboard.metrics.restaurantStatus.active"),
          sub:
            stats.pausedCount > 0
              ? t("admin.dashboard.metrics.restaurantStatus.subPaused", {
                  count: stats.pausedCount,
                })
              : t("admin.dashboard.metrics.restaurantStatus.subActive"),
          icon:
            stats.pausedCount > 0
              ? ("pause-circle-outline" as const)
              : ("checkmark-circle-outline" as const),
          accent: stats.pausedCount > 0 ? theme.colors.error : theme.colors.success,
        },
        {
          label: t("admin.dashboard.metrics.totalCovers.label"),
          value: fmtNumber(stats.totalCovers),
          sub: t("admin.dashboard.metrics.totalCovers.sub"),
          icon: "people-outline" as const,
          accent: "#d97706",
        },
      ]
    : [];

  const QUICK_ACTIONS = [
    {
      title: t("admin.bookings.newBooking"),
      icon: "person-add-outline" as const,
      onPress: () => router.push({ pathname: "/admin/bookings", params: { create: "1" } }),
      primary: true,
    },
    {
      title: t("admin.dashboard.quickActions.viewAllBookings"),
      icon: "list-outline" as const,
      route: "/admin/bookings" as const,
    },
    {
      title: t("admin.bookings.restaurantAction.title.pause"),
      icon: "pause-circle-outline" as const,
      onPress: () => {
        setActionType("pause");
        setActionModalVisible(true);
      },
    },
    {
      title: t("admin.bookings.restaurantAction.title.extend"),
      icon: "time-outline" as const,
      onPress: () => {
        setActionType("extend");
        setActionModalVisible(true);
      },
    },
    {
      title: t("admin.dashboard.quickActions.manageSettings"),
      icon: "settings-outline" as const,
      route: "/admin/settings/brand" as const,
    },
  ];

  return (
    <ThemedView style={styles.root}>
      {Platform.OS !== "web" && (
        <Stack.Screen options={{ title: t("admin.dashboard.nativeTitle") }} />
      )}
      <ScrollView contentContainerStyle={styles.outer} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View>
            <ThemedText type="h1">{t("admin.dashboard.title")}</ThemedText>
            <ThemedText style={[styles.pageSub, { color: colors.muted }]}>
              {t("admin.dashboard.welcomeSubtitle")}
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
            <ScheduleConflictsBanner
              count={stats?.scheduleConflictsCount ?? 0}
              locationIds={stats?.scheduleConflictLocationIds ?? []}
            />
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
                  <ThemedText style={styles.cardTitle}>
                    {t("admin.dashboard.chart.title")}
                  </ThemedText>
                  <ThemedText style={[styles.chartSub, { color: colors.muted }]}>
                    {t("admin.dashboard.chart.last7Days")}
                  </ThemedText>
                </View>
                <OccupancyChart
                  primaryColor={primaryColor}
                  colors={colors}
                  isDark={isDark}
                  data={stats?.occupancyData ?? []}
                  dates={stats?.occupancyDates ?? []}
                  counts={stats?.occupancyCounts ?? []}
                />
              </View>

              <View style={[styles.actionsCol, isWide && styles.actionsColWide]}>
                {QUICK_ACTIONS.map((action) => (
                  <Pressable
                    key={action.title}
                    onPress={() => (action.route ? router.push(action.route) : action.onPress?.())}
                    accessibilityRole={action.route ? "link" : "button"}
                    accessibilityLabel={action.title}
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
                    <Icon
                      name={action.icon}
                      size="xxl"
                      color={action.primary ? theme.colors.white : primaryColor}
                    />
                    <ThemedText
                      style={[styles.actionTitle, action.primary && { color: theme.colors.white }]}
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
                <ThemedText style={styles.cardTitle}>
                  {t("admin.dashboard.metrics.todayBookings.label")}
                </ThemedText>
                <Pressable
                  onPress={() => router.push("/admin/bookings")}
                  accessibilityRole="link"
                  accessibilityLabel={t("admin.dashboard.recentBookings.viewAllLabel")}
                >
                  <ThemedText style={[styles.viewAll, { color: primaryColor }]}>
                    {t("admin.dashboard.recentBookings.viewAll")}
                  </ThemedText>
                </Pressable>
              </View>
              {stats?.recentBookings.length === 0 ? (
                <View style={styles.emptyRecent}>
                  <ThemedText style={[styles.emptyText, { color: colors.muted }]}>
                    {t("admin.dashboard.recentBookings.empty")}
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
        title={t("admin.dashboard.successTitle")}
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
    icon: IconName;
    accent: string;
  };
  colors: ThemeColors;
}) {
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.metricIconWrap, { backgroundColor: `${stat.accent}14` }]}>
        <Icon name={stat.icon} size="xl" color={stat.accent} />
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
  dates,
  counts,
}: {
  primaryColor: string;
  colors: ThemeColors;
  isDark: boolean;
  data: number[];
  dates?: string[];
  counts?: number[];
}) {
  const { t } = useTranslation();
  const chartData = data?.length > 0 ? data : [0, 0, 0, 0, 0, 0, 0];
  const [labelMode, setLabelMode] = useState<"relative" | "calendar">("relative");

  const relativeLabels = [
    t("admin.dashboard.chart.dayLabel.tMinus6"),
    t("admin.dashboard.chart.dayLabel.tMinus5"),
    t("admin.dashboard.chart.dayLabel.tMinus4"),
    t("admin.dashboard.chart.dayLabel.tMinus3"),
    t("admin.dashboard.chart.dayLabel.tMinus2"),
    t("admin.dashboard.chart.dayLabel.tMinus1"),
    t("admin.dashboard.chart.dayLabel.today"),
  ];
  const formatCalendar = (iso: string) => fmtMonthDay(new Date(iso));

  const labelFor = (i: number) => {
    if (labelMode === "calendar" && dates && dates[i]) {
      return i === 6 ? t("admin.dashboard.chart.dayLabel.today") : formatCalendar(dates[i]);
    }
    return relativeLabels[i];
  };

  const hasCounts = !!counts && counts.length > 0;
  const peakCount = hasCounts ? Math.max(...(counts as number[])) : 0;
  const peakIndex = hasCounts ? (counts as number[]).indexOf(peakCount) : -1;
  const totalBookings = hasCounts ? (counts as number[]).reduce((a, b) => a + b, 0) : 0;
  const peakWeekday =
    peakIndex >= 0 && dates && dates[peakIndex]
      ? fmtWeekday(new Date(dates[peakIndex]))
      : peakIndex >= 0
        ? relativeLabels[peakIndex]
        : "";

  const summary =
    totalBookings > 0
      ? t("admin.dashboard.chart.summary", {
          count: totalBookings,
          perDay: (totalBookings / 7).toFixed(1),
          weekday: peakWeekday,
        })
      : t("admin.dashboard.chart.summaryEmpty");

  return (
    <View style={styles.chartArea}>
      <View style={styles.chartHeaderRow}>
        <ThemedText
          testID="occupancy-summary"
          style={[styles.summaryText, { color: colors.muted }]}
        >
          {summary}
        </ThemedText>
        <View style={styles.toggleRow}>
          <Pressable
            testID="occupancy-toggle-relative"
            onPress={() => setLabelMode("relative")}
            accessibilityRole="radio"
            accessibilityLabel={t("admin.dashboard.chart.toggle.relativeLabel")}
            accessibilityState={{ checked: labelMode === "relative" }}
            style={[
              styles.toggleSegment,
              labelMode === "relative"
                ? { backgroundColor: primaryColor }
                : { backgroundColor: `${colors.muted}14` },
            ]}
          >
            <ThemedText
              style={[
                styles.toggleText,
                { color: labelMode === "relative" ? theme.colors.white : colors.muted },
              ]}
            >
              {t("admin.dashboard.chart.toggle.relativeText")}
            </ThemedText>
          </Pressable>
          <Pressable
            testID="occupancy-toggle-calendar"
            onPress={() => setLabelMode("calendar")}
            accessibilityRole="radio"
            accessibilityLabel={t("admin.dashboard.chart.toggle.calendarLabel")}
            accessibilityState={{ checked: labelMode === "calendar" }}
            style={[
              styles.toggleSegment,
              labelMode === "calendar"
                ? { backgroundColor: primaryColor }
                : { backgroundColor: `${colors.muted}14` },
            ]}
          >
            <ThemedText
              style={[
                styles.toggleText,
                { color: labelMode === "calendar" ? theme.colors.white : colors.muted },
              ]}
            >
              {t("admin.dashboard.chart.toggle.datesText")}
            </ThemedText>
          </Pressable>
        </View>
      </View>
      <View style={styles.chartBars}>
        {chartData.map((val, i) => {
          const isPeak = i === peakIndex;
          const count = hasCounts ? (counts as number[])[i] : null;
          return (
            <View key={i} style={styles.barContainer}>
              <ThemedText
                testID={`occupancy-count-${i}`}
                style={[
                  styles.countLabel,
                  { color: isPeak ? primaryColor : colors.muted },
                  isPeak && styles.countLabelPeak,
                ]}
              >
                {count === null ? "–" : count}
              </ThemedText>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      backgroundColor: isPeak
                        ? primaryColor
                        : isDark
                          ? `${primaryColor}99`
                          : `${primaryColor}55`,
                      height: `${Math.max(2, val)}%` as `${number}%`,
                    },
                  ]}
                />
              </View>
              <ThemedText style={[styles.barLabel, { color: colors.muted }]}>
                {labelFor(i)}
              </ThemedText>
            </View>
          );
        })}
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
  const { t } = useTranslation();
  const now = new Date();
  const startTime = new Date(booking.date);
  const endTime = booking.endTime
    ? new Date(booking.endTime)
    : new Date(startTime.getTime() + 60 * 60 * 1000);

  const isCancelled = !!booking.isCancelled;
  const isActive = !isCancelled && now >= startTime && now <= endTime;

  const bubbleBg = isCancelled
    ? `${theme.colors.error}1a`
    : isActive
      ? `${colors.success}18`
      : `${colors.muted}14`;

  const bubbleTextColor = isCancelled
    ? theme.colors.error
    : isActive
      ? colors.success
      : colors.muted;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t(
        isCancelled
          ? "admin.dashboard.recentBookings.itemLabelCancelled"
          : "admin.dashboard.recentBookings.itemLabel",
        {
          time: fmtTime(startTime),
          guest: booking.customerName ?? booking.customerEmail,
          seats: t("booking.form.partySize", { count: booking.seats }),
          restaurant: booking.restaurantName,
        }
      )}
      style={({ hovered }: any) => [
        styles.bookingItem,
        { borderTopColor: colors.border },
        hovered && { backgroundColor: `${colors.muted}08` },
        isActive && { backgroundColor: `${colors.success}05` },
      ]}
    >
      <View style={[styles.bookingTime, { backgroundColor: bubbleBg }]}>
        <ThemedText style={[styles.bookingTimeText, { color: bubbleTextColor }]}>
          {fmtTime(startTime)}
        </ThemedText>
      </View>
      <View style={styles.bookingInfo}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ThemedText style={styles.bookingEmail} numberOfLines={1}>
            {booking.customerName ?? booking.customerEmail}
          </ThemedText>
          {isCancelled ? (
            <View style={styles.cancelledBadge}>
              <ThemedText style={styles.cancelledBadgeText}>
                {t("admin.bookings.status.cancelled")}
              </ThemedText>
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
          {t("admin.dashboard.recentBookings.meta", {
            seats: t("booking.form.partySize", { count: booking.seats }),
            restaurant: booking.restaurantName,
          })}
        </ThemedText>
      </View>
      <Icon name="chevron-forward" size="md" color={colors.muted} />
    </Pressable>
  );
}
