import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "react-i18next";
import Button from "@/components/common/Button";
import {
  getAdminBookings,
  adminDeleteBooking,
  adminLookupBookings,
  BookingDetailDto,
  BookingStatusFilter,
} from "@/api/admin";
import { fetchRestaurants, RestaurantDto } from "@/api/restaurants";
import { getHoursForDay } from "@/utils/openingHours";
import ConfirmModal from "@/components/common/ConfirmModal";
import AlertModal from "@/components/common/AlertModal";
import { NewBookingModal } from "@/components/admin/bookings/NewBookingModal";
import { useEffect, useRef, useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useBookingsGrid } from "@/hooks/use-bookings-grid";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  Platform,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";

import { AvailabilityGrid } from "@/components/admin/bookings/AvailabilityGrid";
import { BookingDetailPopup } from "@/components/admin/bookings/BookingDetailPopup";
import { BookingsWideTable } from "@/components/admin/bookings/BookingsWideTable";
import { BookingsCardList } from "@/components/admin/bookings/BookingsCardList";
import { BookingLookupBar } from "@/components/admin/bookings/BookingLookupBar";
import {
  defaultSortFor,
  nextSort,
  sortBookings,
  type SortKey,
  type SortState,
} from "@/components/admin/bookings/sorting";
import { styles } from "@/components/admin/bookings/bookings.styles";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { fmtDate, isoDate } from "@/utils/formatters";
import { Icon } from "@/components/common/Icon";

type ViewMode = "timetable" | "list";

export default function AdminBookingsScreen() {
  const { t } = useTranslation();
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<number | null>(null);
  const [persistedRestaurantId, setPersistedRestaurantId] = usePersistedState<number | null>(
    "bookings:restaurantId",
    null
  );
  const [bookings, setBookings] = useState<BookingDetailDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = usePersistedState<ViewMode>("bookings:viewMode", "timetable");
  const [statusFilter, setStatusFilter] = usePersistedState<BookingStatusFilter>(
    "bookings:statusFilter",
    "active"
  );
  // Sort preference persists across sessions but resets to the contextual
  // default whenever the status filter changes (see effect below) — so the
  // "past" tab still defaults to most-recent-first, etc.
  const [sort, setSort] = usePersistedState<SortState>(
    "bookings:sort",
    defaultSortFor(statusFilter)
  );

  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BookingDetailDto | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const { errorMessage, showError, clearError } = useErrorHandler();
  const [refreshKey, setRefreshKey] = useState(0);
  const [focusedRowId, setFocusedRowId] = useState<number | null>(null);
  const [detailInitialFocus, setDetailInitialFocus] = useState<"extend" | undefined>(undefined);

  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<"idle" | "not_found" | "multiple">("idle");

  const router = useRouter();
  const {
    create,
    query: queryParam,
    restaurantId: restaurantIdParam,
  } = useLocalSearchParams<{
    create?: string;
    query?: string;
    restaurantId?: string;
  }>();
  const searchQuery = queryParam || null;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (create === "1") setShowNewModal(true);
  }, [create]);

  const { colors, isDark, primaryColor: PRIMARY } = useAppTheme();
  const { width } = useWindowDimensions();

  const {
    gridDate,
    gridSections,
    gridBookings,
    gridLoading,
    loadGrid,
    handleGridDateChange,
    resetToToday,
  } = useBookingsGrid({ restaurantId: selectedRestaurantId, viewMode });

  const selectedRestaurant = restaurants.find((r) => r.id === selectedRestaurantId);
  const gridIsoDay = gridDate.getDay() === 0 ? 7 : gridDate.getDay();
  const gridDayHours = getHoursForDay(selectedRestaurant ?? {}, gridIsoDay);
  const openTime = gridDayHours.open;
  const closeTime = gridDayHours.close;
  const timezone = selectedRestaurant?.timezone ?? "UTC";

  const borderColor = colors.border;
  const cardBg = colors.card;
  const mutedColor = colors.muted;
  const isWide = width >= 640;

  useEffect(() => {
    let cancelled = false;
    fetchRestaurants().then((data) => {
      if (cancelled) return;
      setRestaurants(data);
      const paramId = restaurantIdParam ? parseInt(restaurantIdParam, 10) : NaN;
      const paramMatch = !isNaN(paramId) && data.find((r) => r.id === paramId);
      const persistedMatch =
        !paramMatch && persistedRestaurantId != null
          ? data.find((r) => r.id === persistedRestaurantId)
          : undefined;
      const nextId = paramMatch
        ? paramMatch.id
        : persistedMatch
          ? persistedMatch.id
          : (data[0]?.id ?? null);
      setSelectedRestaurantId(nextId);
      setPersistedRestaurantId(nextId);
    });
    return () => {
      cancelled = true;
    };
    // persistedRestaurantId seeds the initial selection only; omitting it avoids a refetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantIdParam]);

  useEffect(() => {
    if (searchQuery) {
      let cancelled = false;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(true);
      getAdminBookings(undefined, undefined, "all", searchQuery).then((b) => {
        if (!cancelled) {
          setBookings(b);
          setLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }
    if (!selectedRestaurantId) return;
    let cancelled = false;

    setLoading(true);
    getAdminBookings(selectedRestaurantId, undefined, statusFilter).then((b) => {
      if (!cancelled) {
        setBookings(b);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [statusFilter, selectedRestaurantId, searchQuery, refreshKey]);

  const handleSelectRestaurant = (id: number) => {
    if (id === selectedRestaurantId) return;
    setSelectedRestaurantId(id);
    setPersistedRestaurantId(id);
    if (viewMode === "timetable") loadGrid(id, gridDate);
  };

  // When the user switches status filter, reset the sort to that tab's
  // contextual default (e.g. past = most-recent-first). We deliberately do NOT
  // fire on the initial mount — a sort preference persisted from a previous
  // session should survive reload. `prevStatusFilter` starts undefined, so the
  // first (mount) run is skipped; subsequent real changes trigger the reset.
  const prevStatusFilter = useRef<BookingStatusFilter | undefined>(undefined);
  useEffect(() => {
    const prev = prevStatusFilter.current;
    prevStatusFilter.current = statusFilter;
    if (prev === undefined || prev === statusFilter) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSort(defaultSortFor(statusFilter));
  }, [statusFilter, setSort]);

  const switchToTimetable = () => {
    setViewMode("timetable");
    if (selectedRestaurantId) loadGrid(selectedRestaurantId, gridDate);
  };

  const reconcileAfterBookingMutation = () => {
    setRefreshKey((key) => key + 1);
    if (selectedRestaurantId && viewMode === "timetable") {
      loadGrid(selectedRestaurantId, gridDate);
    }
  };

  const sorted = sortBookings(bookings, sort);

  const handleSortChange = (key: SortKey) => setSort((prev) => nextSort(prev, key));

  // Only wired via useKeyboardShortcuts below when sorted.length > 0, so
  // sorted is guaranteed non-empty whenever this actually runs.
  const moveRowFocus = (delta: number) => {
    setFocusedRowId((current) => {
      const idx = current == null ? -1 : sorted.findIndex((b) => b.id === current);
      const nextIdx = Math.min(Math.max(idx + delta, 0), sorted.length - 1);
      return sorted[nextIdx].id;
    });
  };

  const openBooking = (id: number, focus?: "extend") => {
    setDetailInitialFocus(focus);
    setSelectedBookingId(id);
  };

  const openFocusedRow = (focus?: "extend") => {
    if (focusedRowId != null) openBooking(focusedRowId, focus);
  };

  // Suppressed whenever a booking popup or modal is already open — otherwise
  // a stray j/k/Enter/e keypress (e.g. focus left on a non-text Pressable
  // inside the open popup) can silently reassign selectedBookingId and swap
  // which booking the popup displays underneath the user, with no visible
  // cue (issue #140 review, Concern 1).
  const listShortcutsBlocked = selectedBookingId !== null || showNewModal || !!cancelTarget;

  useKeyboardShortcuts(
    viewMode === "list" && sorted.length > 0 && !listShortcutsBlocked
      ? {
          j: () => moveRowFocus(1),
          ArrowDown: () => moveRowFocus(1),
          k: () => moveRowFocus(-1),
          ArrowUp: () => moveRowFocus(-1),
          Enter: () => openFocusedRow(),
          e: () => openFocusedRow("extend"),
        }
      : {}
  );

  const handleLookup = async () => {
    const q = lookupQuery.trim();
    if (!q) return;
    setLookupLoading(true);
    setLookupStatus("idle");
    try {
      const results = await adminLookupBookings(q);
      if (results.length === 0) {
        setLookupStatus("not_found");
      } else if (results.length === 1) {
        setLookupQuery("");
        setSelectedBookingId(results[0].id);
      } else {
        setLookupStatus("multiple");
        router.replace({ pathname: "/admin/bookings", params: { query: q } });
      }
    } finally {
      setLookupLoading(false);
    }
  };

  const todayCount = bookings.filter((b) => {
    const bd = new Date(b.date);
    const today = new Date();
    return (
      bd.getDate() === today.getDate() &&
      bd.getMonth() === today.getMonth() &&
      bd.getFullYear() === today.getFullYear()
    );
  }).length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {Platform.OS !== "web" && (
        <Stack.Screen
          options={{
            title:
              viewMode === "timetable"
                ? fmtDate(gridDate)
                : statusFilter === "past"
                  ? t("admin.bookings.screenTitle.past")
                  : statusFilter === "cancelled"
                    ? t("admin.bookings.screenTitle.cancelled")
                    : t("admin.bookings.screenTitle.live"),
          }}
        />
      )}

      <View style={styles.pageHeader}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.pageTitle}>
            {searchQuery ? t("admin.bookings.searchResultsTitle") : t("admin.bookings.pageTitle")}
          </ThemedText>
          <ThemedText style={[styles.pageSub, { color: mutedColor }]}>
            {searchQuery
              ? t("admin.bookings.searchResultsCount", {
                  count: bookings.length,
                  query: searchQuery,
                })
              : viewMode === "timetable"
                ? fmtDate(gridDate)
                : t("admin.bookings.totalTodaySummary", {
                    total: bookings.length,
                    today: todayCount,
                  })}
          </ThemedText>
        </View>

        <View style={styles.headerControls}>
          <BookingLookupBar
            query={lookupQuery}
            loading={lookupLoading}
            status={lookupStatus}
            onQueryChange={(t) => {
              setLookupQuery(t);
              if (lookupStatus !== "idle") setLookupStatus("idle");
            }}
            onSubmit={handleLookup}
            borderColor={colors.border}
            inputBg={colors.input}
            textColor={colors.text}
            placeholderColor={colors.muted}
            primaryColor={PRIMARY}
          />

          {searchQuery ? (
            <Button
              variant="secondary"
              tone="neutral"
              size="md"
              icon="close-outline"
              onPress={() => router.replace("/admin/bookings")}
              accessibilityLabel={t("admin.bookings.clearSearchLabel")}
            >
              {t("admin.bookings.clearSearch")}
            </Button>
          ) : (
            <Button
              size="md"
              icon="add-outline"
              onPress={() => setShowNewModal(true)}
              accessibilityLabel={t("admin.bookings.newBookingLabel")}
            >
              {t("admin.bookings.newBooking")}
            </Button>
          )}
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {restaurants.length > 1 &&
          restaurants.map((r) => (
            <Pressable
              key={r.id}
              style={[
                styles.chip,
                { borderColor },
                r.id === selectedRestaurantId && { backgroundColor: PRIMARY, borderColor: PRIMARY },
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

        <View style={{ flex: 1 }} />

        {viewMode === "list" && (
          <View style={[styles.modeToggle, { borderColor, backgroundColor: cardBg }]}>
            {(
              [
                { key: "active", label: t("admin.bookings.tabs.active"), color: PRIMARY },
                { key: "past", label: t("admin.bookings.tabs.past"), color: "#7c3aed" },
                {
                  key: "cancelled",
                  label: t("admin.bookings.tabs.cancelled"),
                  color: theme.status.cancelled.text,
                },
              ] as const
            ).map(({ key, label, color }) => (
              <Pressable
                key={key}
                style={[styles.modeBtn, statusFilter === key && { backgroundColor: color }]}
                onPress={() => setStatusFilter(key)}
                accessibilityRole="radio"
                accessibilityLabel={t("admin.bookings.tabs.showLabel", {
                  tab: label.toLowerCase(),
                })}
                accessibilityState={{ checked: statusFilter === key }}
              >
                <ThemedText
                  style={[
                    styles.modeBtnText,
                    { color: statusFilter === key ? "#fff" : mutedColor },
                  ]}
                >
                  {label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        )}

        <View style={[styles.modeToggle, { borderColor, backgroundColor: cardBg }]}>
          <Pressable
            testID="view-toggle-timetable"
            style={[styles.modeBtn, viewMode === "timetable" && { backgroundColor: PRIMARY }]}
            onPress={switchToTimetable}
            accessibilityRole="radio"
            accessibilityLabel={t("admin.bookings.viewToggle.timetableLabel")}
            accessibilityState={{ checked: viewMode === "timetable" }}
          >
            <Icon
              name="grid-outline"
              size={15}
              color={viewMode === "timetable" ? "#fff" : mutedColor}
            />
            {isWide && (
              <ThemedText
                style={[
                  styles.modeBtnText,
                  { color: viewMode === "timetable" ? "#fff" : mutedColor },
                ]}
              >
                {t("admin.bookings.viewToggle.timetable")}
              </ThemedText>
            )}
          </Pressable>
          <Pressable
            testID="view-toggle-list"
            style={[styles.modeBtn, viewMode === "list" && { backgroundColor: PRIMARY }]}
            onPress={() => setViewMode("list")}
            accessibilityRole="radio"
            accessibilityLabel={t("admin.bookings.viewToggle.listLabel")}
            accessibilityState={{ checked: viewMode === "list" }}
          >
            <Icon name="list-outline" size={15} color={viewMode === "list" ? "#fff" : mutedColor} />
            {isWide && (
              <ThemedText
                style={[styles.modeBtnText, { color: viewMode === "list" ? "#fff" : mutedColor }]}
              >
                {t("admin.bookings.viewToggle.list")}
              </ThemedText>
            )}
          </Pressable>
        </View>
      </View>

      {loading && viewMode === "list" ? (
        <ActivityIndicator style={styles.spinner} size="large" color={PRIMARY} />
      ) : viewMode === "timetable" ? (
        <View style={[styles.gridCard, { backgroundColor: cardBg, borderColor }]}>
          <View style={[styles.gridDateBar, { borderBottomColor: borderColor }]}>
            <Pressable
              testID="grid-nav-prev"
              style={styles.gridNavBtn}
              onPress={() => handleGridDateChange(-1)}
              accessibilityRole="button"
              accessibilityLabel={t("admin.bookings.timetable.previousDay")}
            >
              <Icon name="chevron-back" size="lg" color={PRIMARY} />
            </Pressable>
            <Pressable
              onPress={resetToToday}
              style={styles.gridDateLabel}
              accessibilityRole="button"
              accessibilityLabel={t("admin.bookings.timetable.jumpToTodayLabel", {
                date: fmtDate(gridDate),
              })}
            >
              <ThemedText style={styles.gridDateText}>{fmtDate(gridDate)}</ThemedText>
              {gridDate.toDateString() !== new Date().toDateString() && (
                <ThemedText style={[styles.gridTodayHint, { color: PRIMARY }]}>
                  {t("admin.bookings.timetable.tapForToday")}
                </ThemedText>
              )}
            </Pressable>
            <Pressable
              testID="grid-nav-next"
              style={styles.gridNavBtn}
              onPress={() => handleGridDateChange(1)}
              accessibilityRole="button"
              accessibilityLabel={t("admin.bookings.timetable.nextDay")}
            >
              <Icon name="chevron-forward" size="lg" color={PRIMARY} />
            </Pressable>
          </View>

          <View style={[styles.gridLegend, { borderBottomColor: borderColor }]}>
            <View
              style={[
                styles.legendItem,
                {
                  backgroundColor: `${PRIMARY}22`,
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                },
              ]}
            >
              <View style={[styles.legendDot, { backgroundColor: PRIMARY }]} />
              <ThemedText style={[styles.legendText, { color: mutedColor }]}>
                {t("admin.bookings.timetable.legend.seatedNow")}
              </ThemedText>
            </View>
            <View
              style={[
                styles.legendItem,
                { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
              ]}
            >
              <View style={[styles.legendDot, { backgroundColor: `${PRIMARY}44` }]} />
              <ThemedText style={[styles.legendText, { color: mutedColor }]}>
                {t("admin.bookings.timetable.legend.booked")}
              </ThemedText>
            </View>
            <View
              style={[
                styles.legendItem,
                { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
              ]}
            >
              <View
                style={[
                  styles.legendDot,
                  { width: 3, backgroundColor: colors.error, borderRadius: 0 },
                ]}
              />
              <ThemedText style={[styles.legendText, { color: mutedColor }]}>
                {t("admin.bookings.timetable.legend.now")}
              </ThemedText>
            </View>
            <ThemedText style={[styles.legendText, { color: mutedColor, marginLeft: 4 }]}>
              {t("admin.bookings.timetable.legend.tapHint")}
            </ThemedText>
          </View>

          {gridLoading ? (
            <ActivityIndicator style={{ padding: 40 }} size="large" color={PRIMARY} />
          ) : (
            <AvailabilityGrid
              sections={gridSections}
              bookings={gridBookings}
              isDark={isDark}
              onBookingPress={(b) => openBooking(b.id)}
              groups={selectedRestaurant?.groups ?? []}
              openTime={openTime}
              closeTime={closeTime}
              timezone={timezone}
              defaultDurationMinutes={selectedRestaurant?.defaultBookingDurationMinutes ?? 90}
              gridDateIso={isoDate(gridDate)}
              dateLabel={fmtDate(gridDate)}
            />
          )}
        </View>
      ) : sorted.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="calendar-outline" size={40} color={mutedColor} />
          <ThemedText style={[styles.emptyText, { color: mutedColor }]}>
            {t("admin.bookings.emptyState")}
          </ThemedText>
          <Button
            size="md"
            icon="add-outline"
            style={styles.emptyStateAction}
            onPress={() => setShowNewModal(true)}
            accessibilityLabel={t("admin.bookings.newBookingLabel")}
          >
            {t("admin.bookings.newBooking")}
          </Button>
        </View>
      ) : isWide ? (
        <BookingsWideTable
          bookings={sorted}
          focusedRowId={focusedRowId}
          onOpenBooking={(id) => openBooking(id)}
          onCancelBooking={(b) => setCancelTarget(b)}
          sort={sort}
          onSortChange={handleSortChange}
          borderColor={borderColor}
          cardBg={cardBg}
          mutedColor={mutedColor}
          isDark={isDark}
          primaryColor={PRIMARY}
        />
      ) : (
        <BookingsCardList
          bookings={sorted}
          focusedRowId={focusedRowId}
          onOpenBooking={(id) => openBooking(id)}
          sort={sort}
          onSortChange={handleSortChange}
          borderColor={borderColor}
          cardBg={cardBg}
          mutedColor={mutedColor}
          isDark={isDark}
          primaryColor={PRIMARY}
        />
      )}

      <BookingDetailPopup
        bookingId={selectedBookingId}
        onClose={() => {
          setSelectedBookingId(null);
          setDetailInitialFocus(undefined);
        }}
        onMutated={reconcileAfterBookingMutation}
        initialFocus={detailInitialFocus}
      />

      <NewBookingModal
        visible={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={(id) => {
          setShowNewModal(false);
          setSelectedBookingId(id);
          reconcileAfterBookingMutation();
        }}
      />

      <ConfirmModal
        visible={!!cancelTarget}
        title={t("admin.bookings.cancelBookingTitle")}
        message={
          cancelTarget
            ? t("admin.bookings.cancelBookingConfirm", {
                name: cancelTarget.customerName ?? cancelTarget.customerEmail,
              })
            : ""
        }
        confirmLabel={t("admin.bookings.cancelBookingTitle")}
        cancelLabel={t("admin.bookings.keep")}
        destructive
        onConfirm={async () => {
          if (!cancelTarget) return;
          const id = cancelTarget.id;
          setCancelTarget(null);
          try {
            await adminDeleteBooking(id);
            reconcileAfterBookingMutation();
          } catch (err) {
            showError(err);
          }
        }}
        onCancel={() => setCancelTarget(null)}
      />

      <AlertModal
        visible={errorMessage !== null}
        title={t("errors.title")}
        message={errorMessage ?? ""}
        onClose={clearError}
      />
    </ScrollView>
  );
}
