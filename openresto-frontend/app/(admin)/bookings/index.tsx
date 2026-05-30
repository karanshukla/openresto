import { ThemedText } from "@/components/themed-text";
import {
  getAdminBookings,
  adminGetTables,
  adminDeleteBooking,
  adminLookupBookings,
  BookingDetailDto,
  SectionWithTables,
  BookingStatusFilter,
} from "@/api/admin";
import { fetchRestaurants, RestaurantDto } from "@/api/restaurants";
import ConfirmModal from "@/components/common/ConfirmModal";
import { NewBookingModal } from "@/components/admin/bookings/NewBookingModal";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
  Platform,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { COLORS, FORM_SIZES, getThemeColors } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import { useBrand } from "@/context/BrandContext";

import { StatusBadge } from "@/components/admin/bookings/StatusBadge";
import { AvailabilityGrid } from "@/components/admin/bookings/AvailabilityGrid";
import { BookingDetailPopup } from "@/components/admin/bookings/BookingDetailPopup";
import { styles } from "@/components/admin/bookings/bookings.styles";

type ViewMode = "timetable" | "list";

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function isoDate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function initials(nameOrEmail: string) {
  const name = nameOrEmail.includes("@")
    ? nameOrEmail.split("@")[0].replace(/[._-]/g, " ").trim()
    : nameOrEmail.trim();
  const parts = name.split(" ");
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export default function AdminBookingsScreen() {
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<number | null>(null);
  const [bookings, setBookings] = useState<BookingDetailDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("timetable");
  const [statusFilter, setStatusFilter] = useState<BookingStatusFilter>("active");

  const [gridDate, setGridDate] = useState(new Date());
  const [gridSections, setGridSections] = useState<SectionWithTables[]>([]);
  const [gridBookings, setGridBookings] = useState<BookingDetailDto[]>([]);
  const [gridLoading, setGridLoading] = useState(false);

  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BookingDetailDto | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupStatus, setLookupStatus] = useState<"idle" | "not_found" | "multiple">("idle");

  const router = useRouter();
  const {
    create,
    email: emailParam,
    bookingRef: bookingRefParam,
  } = useLocalSearchParams<{ create?: string; email?: string; bookingRef?: string }>();
  const searchQuery = emailParam || bookingRefParam || null;

  useEffect(() => {
    if (create === "1") setShowNewModal(true);
  }, [create]);

  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const { width } = useWindowDimensions();
  const brand = useBrand();
  const PRIMARY = brand.primaryColor || COLORS.primary;

  const selectedRestaurant = restaurants.find((r) => r.id === selectedRestaurantId);
  const openTime = selectedRestaurant?.openTime ?? "09:00";
  const closeTime = selectedRestaurant?.closeTime ?? "22:00";
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
      if (data.length > 0) setSelectedRestaurantId(data[0].id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (searchQuery) {
      let cancelled = false;
      setLoading(true);
      getAdminBookings(undefined, undefined, "all", emailParam, bookingRefParam).then((b) => {
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
  }, [statusFilter, selectedRestaurantId, searchQuery, emailParam, bookingRefParam, refreshKey]);

  const handleSelectRestaurant = (id: number) => {
    if (id === selectedRestaurantId) return;
    setSelectedRestaurantId(id);
    if (viewMode === "timetable") loadGrid(id, gridDate);
  };

  async function loadGrid(restaurantId: number, date: Date) {
    setGridLoading(true);
    const [sections, bookingsForDate] = await Promise.all([
      adminGetTables(restaurantId),
      getAdminBookings(restaurantId, isoDate(date)),
    ]);
    setGridSections(sections);
    setGridBookings(bookingsForDate);
    setGridLoading(false);
  }

  const switchToTimetable = () => {
    setViewMode("timetable");
    if (selectedRestaurantId) loadGrid(selectedRestaurantId, gridDate);
  };

  const handleGridDateChange = (delta: number) => {
    const next = new Date(gridDate);
    next.setDate(next.getDate() + delta);
    setGridDate(next);
    if (selectedRestaurantId) loadGrid(selectedRestaurantId, next);
  };

  // Load timetable on mount when restaurant is selected
  useEffect(() => {
    if (selectedRestaurantId && viewMode === "timetable") {
      loadGrid(selectedRestaurantId, gridDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRestaurantId]);

  // Past tab: most-recent first. All other views: soonest first.
  const sorted = [...bookings].sort((a, b) => {
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
    return statusFilter === "past" ? -diff : diff;
  });

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
        const isEmail = q.includes("@");
        router.replace({
          pathname: "/(admin)/bookings",
          params: isEmail ? { email: q } : { bookingRef: q },
        });
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
                  ? "Past Bookings"
                  : statusFilter === "cancelled"
                    ? "Cancelled Bookings"
                    : "Live Bookings",
          }}
        />
      )}

      {/* Page header */}
      <View style={styles.pageHeader}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.pageTitle}>
            {searchQuery ? "Search Results" : "Bookings"}
          </ThemedText>
          <ThemedText style={[styles.pageSub, { color: mutedColor }]}>
            {searchQuery
              ? `${bookings.length} result${bookings.length !== 1 ? "s" : ""} for "${searchQuery}"`
              : viewMode === "timetable"
                ? fmtDate(gridDate)
                : `${bookings.length} total · ${todayCount} today`}
          </ThemedText>
        </View>

        <View style={styles.headerControls}>
          {/* Lookup input */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <TextInput
              style={[
                {
                  height: FORM_SIZES.inputSmHeight,
                  paddingHorizontal: FORM_SIZES.inputPaddingH,
                  fontSize: 13,
                  borderRadius: FORM_SIZES.inputBorderRadius,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.input,
                  color: colors.text,
                  minWidth: 180,
                },
              ]}
              placeholder="Email or reference…"
              placeholderTextColor={colors.muted}
              value={lookupQuery}
              onChangeText={(t) => {
                setLookupQuery(t);
                if (lookupStatus !== "idle") setLookupStatus("idle");
              }}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={handleLookup}
            />
            <Pressable
              onPress={handleLookup}
              disabled={lookupLoading || !lookupQuery.trim()}
              style={[
                styles.newBookingBtn,
                { backgroundColor: PRIMARY },
                (!lookupQuery.trim() || lookupLoading) && { opacity: 0.5 },
              ]}
            >
              {lookupLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="search-outline" size={15} color="#fff" />
                  <ThemedText style={styles.newBookingBtnText}>Find</ThemedText>
                </>
              )}
            </Pressable>
          </View>

          {searchQuery ? (
            <Pressable
              style={[styles.newBookingBtn, { backgroundColor: mutedColor }]}
              onPress={() => router.replace("/(admin)/bookings")}
            >
              <Ionicons name="close-outline" size={16} color="#fff" />
              <ThemedText style={styles.newBookingBtnText}>Clear</ThemedText>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.newBookingBtn, { backgroundColor: PRIMARY }]}
              onPress={() => setShowNewModal(true)}
            >
              <Ionicons name="add-outline" size={16} color="#fff" />
              <ThemedText style={styles.newBookingBtnText}>New Booking</ThemedText>
            </Pressable>
          )}
        </View>
      </View>

      {lookupStatus === "not_found" && (
        <ThemedText style={{ fontSize: 12, color: COLORS.error, marginTop: -4 }}>
          No booking found.
        </ThemedText>
      )}
      {lookupStatus === "multiple" && (
        <ThemedText style={{ fontSize: 12, color: PRIMARY, marginTop: -4 }}>
          Showing all matches…
        </ThemedText>
      )}

      {/* Toolbar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {/* Restaurant chips */}
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

        {/* Spacer */}
        <View style={{ flex: 1 }} />

        {/* Status filter — only show for list view */}
        {viewMode === "list" && (
          <View style={[styles.modeToggle, { borderColor, backgroundColor: cardBg }]}>
            {(
              [
                { key: "active", label: "Active", color: PRIMARY },
                { key: "past", label: "Past", color: "#7c3aed" },
                { key: "cancelled", label: "Cancelled", color: "#dc2626" },
              ] as const
            ).map(({ key, label, color }) => (
              <Pressable
                key={key}
                style={[styles.modeBtn, statusFilter === key && { backgroundColor: color }]}
                onPress={() => setStatusFilter(key)}
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

        {/* View toggle */}
        <View style={[styles.modeToggle, { borderColor, backgroundColor: cardBg }]}>
          <Pressable
            style={[styles.modeBtn, viewMode === "timetable" && { backgroundColor: PRIMARY }]}
            onPress={switchToTimetable}
          >
            <Ionicons
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
                Timetable
              </ThemedText>
            )}
          </Pressable>
          <Pressable
            style={[styles.modeBtn, viewMode === "list" && { backgroundColor: PRIMARY }]}
            onPress={() => setViewMode("list")}
          >
            <Ionicons
              name="list-outline"
              size={15}
              color={viewMode === "list" ? "#fff" : mutedColor}
            />
            {isWide && (
              <ThemedText
                style={[styles.modeBtnText, { color: viewMode === "list" ? "#fff" : mutedColor }]}
              >
                List
              </ThemedText>
            )}
          </Pressable>
        </View>
      </View>

      {/* Content */}
      {loading && viewMode === "list" ? (
        <ActivityIndicator style={styles.spinner} size="large" color={PRIMARY} />
      ) : viewMode === "timetable" ? (
        /* ── Timetable view ── */
        <View style={[styles.gridCard, { backgroundColor: cardBg, borderColor }]}>
          <View style={[styles.gridDateBar, { borderBottomColor: borderColor }]}>
            <Pressable style={styles.gridNavBtn} onPress={() => handleGridDateChange(-1)}>
              <Ionicons name="chevron-back" size={18} color={PRIMARY} />
            </Pressable>
            <Pressable
              onPress={() => {
                setGridDate(new Date());
                if (selectedRestaurantId) loadGrid(selectedRestaurantId, new Date());
              }}
              style={styles.gridDateLabel}
            >
              <ThemedText style={styles.gridDateText}>{fmtDate(gridDate)}</ThemedText>
              {gridDate.toDateString() !== new Date().toDateString() && (
                <ThemedText style={[styles.gridTodayHint, { color: PRIMARY }]}>
                  tap for today
                </ThemedText>
              )}
            </Pressable>
            <Pressable style={styles.gridNavBtn} onPress={() => handleGridDateChange(1)}>
              <Ionicons name="chevron-forward" size={18} color={PRIMARY} />
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
              <ThemedText style={[styles.legendText, { color: mutedColor }]}>Booked</ThemedText>
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
                  { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb" },
                ]}
              />
              <ThemedText style={[styles.legendText, { color: mutedColor }]}>Available</ThemedText>
            </View>
            <ThemedText style={[styles.legendText, { color: mutedColor, marginLeft: 4 }]}>
              Tap a booking to view details
            </ThemedText>
          </View>

          {gridLoading ? (
            <ActivityIndicator style={{ padding: 40 }} size="large" color={PRIMARY} />
          ) : (
            <AvailabilityGrid
              sections={gridSections}
              bookings={gridBookings}
              isDark={isDark}
              onBookingPress={(b) => setSelectedBookingId(b.id)}
              openTime={openTime}
              closeTime={closeTime}
              timezone={timezone}
            />
          )}
        </View>
      ) : sorted.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={40} color={mutedColor} />
          <ThemedText style={[styles.emptyText, { color: mutedColor }]}>
            No bookings found
          </ThemedText>
          <Pressable
            style={[styles.newBookingBtn, { backgroundColor: PRIMARY, marginTop: 8 }]}
            onPress={() => setShowNewModal(true)}
          >
            <Ionicons name="add-outline" size={16} color="#fff" />
            <ThemedText style={styles.newBookingBtnText}>New Booking</ThemedText>
          </Pressable>
        </View>
      ) : isWide ? (
        /* ── Wide table view ── */
        <View style={[styles.tableCard, { backgroundColor: cardBg, borderColor }]}>
          <View style={[styles.tableHeader, { backgroundColor: isDark ? "#28292b" : "#f8f8f9" }]}>
            <ThemedText style={[styles.thCell, styles.colTime, { color: mutedColor }]}>
              TIME
            </ThemedText>
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

          {sorted.map((b, i) => (
            <Pressable
              key={b.id}
              style={[
                styles.tableRow,
                i > 0 && { borderTopWidth: 1, borderTopColor: borderColor },
                { cursor: "pointer" } as const,
              ]}
              onPress={() => setSelectedBookingId(b.id)}
            >
              {/* Avatar + time */}
              <View
                style={[styles.colTime, { flexDirection: "row", alignItems: "center", gap: 8 }]}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: `${PRIMARY}18`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ThemedText style={{ fontSize: 11, fontWeight: "700", color: PRIMARY }}>
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
                  <View style={[styles.badge, { backgroundColor: "rgba(220,38,38,0.1)" }]}>
                    <ThemedText style={[styles.badgeText, { color: "#dc2626" }]}>
                      Cancelled
                    </ThemedText>
                  </View>
                ) : (
                  <StatusBadge date={b.date} isDark={isDark} />
                )}
              </View>

              <View style={styles.colAction}>
                {!b.isCancelled && (
                  <Pressable
                    style={[styles.rowActionBtn, { backgroundColor: "rgba(220,38,38,0.1)" }]}
                    onPress={(e) => {
                      (e as { stopPropagation?: () => void }).stopPropagation?.();
                      setCancelTarget(b);
                    }}
                  >
                    <Ionicons name="close-outline" size={14} color="#dc2626" />
                  </Pressable>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        /* ── Mobile card list ── */
        <View style={styles.cardList}>
          {sorted.map((b) => (
            <Pressable
              key={b.id}
              style={[styles.listCard, { backgroundColor: cardBg, borderColor }]}
              onPress={() => setSelectedBookingId(b.id)}
            >
              <View style={styles.listCardRow}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: `${PRIMARY}18`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ThemedText style={{ fontSize: 13, fontWeight: "700", color: PRIMARY }}>
                    {initials(b.customerName ?? b.customerEmail)}
                  </ThemedText>
                </View>
                <View style={styles.listCardInfo}>
                  <ThemedText style={styles.tdGuest} numberOfLines={1}>
                    {b.customerName ?? b.customerEmail}
                  </ThemedText>
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
                    <View style={[styles.badge, { backgroundColor: "rgba(220,38,38,0.1)" }]}>
                      <ThemedText style={[styles.badgeText, { color: "#dc2626" }]}>
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
      )}

      {/* Booking detail popup */}
      <BookingDetailPopup
        bookingId={selectedBookingId}
        onClose={() => setSelectedBookingId(null)}
        onDeleted={() => {
          setRefreshKey((k) => k + 1);
          if (selectedRestaurantId && viewMode === "timetable") {
            loadGrid(selectedRestaurantId, gridDate);
          }
        }}
      />

      <NewBookingModal
        visible={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={(id) => {
          setShowNewModal(false);
          setSelectedBookingId(id);
        }}
      />

      <ConfirmModal
        visible={!!cancelTarget}
        title="Cancel Booking"
        message={cancelTarget ? `Cancel booking for ${cancelTarget.customerEmail}?` : ""}
        confirmLabel="Cancel Booking"
        cancelLabel="Keep"
        destructive
        onConfirm={async () => {
          if (!cancelTarget) return;
          const id = cancelTarget.id;
          setCancelTarget(null);
          await adminDeleteBooking(id);
          setBookings((prev) => prev.filter((x) => x.id !== id));
        }}
        onCancel={() => setCancelTarget(null)}
      />
    </ScrollView>
  );
}
