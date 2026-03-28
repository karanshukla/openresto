import { ThemedText } from "@/components/themed-text";
import {
  getAdminBookings,
  adminGetTables,
  adminDeleteBooking,
  BookingDetailDto,
  SectionWithTables,
  BookingStatusFilter,
} from "@/api/admin";
import { fetchRestaurants, RestaurantDto } from "@/api/restaurants";
import ConfirmModal from "@/components/common/ConfirmModal";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { COLORS, getThemeColors } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";

// Refactored components
import { StatusBadge } from "@/components/admin/bookings/StatusBadge";
import { AvailabilityGrid } from "@/components/admin/bookings/AvailabilityGrid";
import { styles } from "@/components/admin/bookings/bookings.styles";

type ViewMode = "list" | "grid";

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function AdminBookingsScreen() {
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<number | null>(null);
  const [bookings, setBookings] = useState<BookingDetailDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [statusFilter, setStatusFilter] = useState<BookingStatusFilter>("active");

  // Grid state
  const [gridDate, setGridDate] = useState(new Date());
  const [gridSections, setGridSections] = useState<SectionWithTables[]>([]);
  const [gridBookings, setGridBookings] = useState<BookingDetailDto[]>([]);
  const [gridLoading, setGridLoading] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<BookingDetailDto | null>(null);

  const router = useRouter();
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const { width } = useWindowDimensions();

  const borderColor = colors.border;
  const cardBg = colors.card;
  const headerBg = isDark ? "#28292b" : "#f8f8f9";
  const mutedColor = colors.muted;
  const isWide = width >= 640;

  // Load restaurants once on mount
  useEffect(() => {
    let cancelled = false;
    fetchRestaurants().then((data) => {
      if (cancelled) return;
      setRestaurants(data);
      if (data.length > 0) {
        setSelectedRestaurantId(data[0].id);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch bookings whenever restaurant or filter changes
  useEffect(() => {
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
  }, [statusFilter, selectedRestaurantId]);

  const handleSelectRestaurant = (id: number) => {
    if (id === selectedRestaurantId) return;
    setSelectedRestaurantId(id); // triggers the useEffect to refetch
    if (viewMode === "grid") loadGrid(id, gridDate);
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

  const switchToGrid = () => {
    setViewMode("grid");
    if (selectedRestaurantId) loadGrid(selectedRestaurantId, gridDate);
  };

  const handleGridDateChange = (delta: number) => {
    const next = new Date(gridDate);
    next.setDate(next.getDate() + delta);
    setGridDate(next);
    if (selectedRestaurantId) loadGrid(selectedRestaurantId, next);
  };

  const sorted = [...bookings].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const getTodayUTCDateString = (): string => {
    const d = new Date();
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const todayCount = bookings.filter((b) => {
    const bookingDate = new Date(b.date);
    const year = bookingDate.getUTCFullYear();
    const month = String(bookingDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(bookingDate.getUTCDate()).padStart(2, "0");
    const bookingDateString = `${year}-${month}-${day}`;
    return bookingDateString === getTodayUTCDateString();
  }).length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.pageHeader}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.pageTitle}>
            {viewMode === "grid"
              ? "Availability"
              : statusFilter === "past"
                ? "Past Bookings"
                : statusFilter === "cancelled"
                  ? "Cancelled Bookings"
                  : "Live Bookings"}
          </ThemedText>
          <ThemedText style={[styles.pageSub, { color: mutedColor }]}>
            {viewMode === "list"
              ? `${bookings.length} total · ${todayCount} today`
              : fmtDate(gridDate)}
          </ThemedText>
        </View>

        <View style={styles.headerControls}>
          {/* Restaurant selector chips */}
          {restaurants.length > 1 &&
            restaurants.map((r) => (
              <Pressable
                key={r.id}
                style={[
                  styles.chip,
                  { borderColor },
                  r.id === selectedRestaurantId && {
                    backgroundColor: COLORS.primary,
                    borderColor: COLORS.primary,
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

          {/* Separator between chips and toggles */}
          {restaurants.length > 1 && (
            <View style={[styles.headerSep, { backgroundColor: borderColor }]} />
          )}

          {/* Status filter toggle */}
          <View style={[styles.modeToggle, { borderColor, backgroundColor: cardBg }]}>
            {(
              [
                { key: "active", label: "Active", color: COLORS.primary },
                { key: "past", label: "Past", color: "#7c3aed" },
                { key: "cancelled", label: "Cancelled", color: "#dc2626" },
              ] as const
            ).map(({ key, label, color }) => (
              <Pressable
                key={key}
                style={[styles.modeBtn, statusFilter === key && { backgroundColor: color }]}
                onPress={() => {
                  setStatusFilter(key);
                  if (key !== "active") setViewMode("list");
                }}
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

          {/* View mode toggle */}
          {statusFilter === "active" && (
            <View style={[styles.modeToggle, { borderColor, backgroundColor: cardBg }]}>
              <Pressable
                style={[styles.modeBtn, viewMode === "list" && { backgroundColor: COLORS.primary }]}
                onPress={() => setViewMode("list")}
              >
                <Ionicons
                  name="list-outline"
                  size={16}
                  color={viewMode === "list" ? "#fff" : mutedColor}
                />
              </Pressable>
              <Pressable
                style={[styles.modeBtn, viewMode === "grid" && { backgroundColor: COLORS.primary }]}
                onPress={switchToGrid}
              >
                <Ionicons
                  name="grid-outline"
                  size={16}
                  color={viewMode === "grid" ? "#fff" : mutedColor}
                />
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.spinner} size="large" color={COLORS.primary} />
      ) : viewMode === "grid" && statusFilter === "active" ? (
        /* ── Grid view ── */
        <View style={[styles.gridCard, { backgroundColor: cardBg, borderColor }]}>
          {/* Date navigation */}
          <View style={[styles.gridDateBar, { borderBottomColor: borderColor }]}>
            <Pressable style={styles.gridNavBtn} onPress={() => handleGridDateChange(-1)}>
              <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
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
                <ThemedText style={[styles.gridTodayHint, { color: COLORS.primary }]}>
                  tap for today
                </ThemedText>
              )}
            </Pressable>
            <Pressable style={styles.gridNavBtn} onPress={() => handleGridDateChange(1)}>
              <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
            </Pressable>
          </View>

          {/* Legend */}
          <View style={[styles.gridLegend, { borderBottomColor: borderColor }]}>
            <View style={[styles.legendItem, { backgroundColor: `${COLORS.primary}22` }]}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
              <ThemedText style={[styles.legendText, { color: mutedColor }]}>Booked</ThemedText>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#f0f0f0" },
                ]}
              />
              <ThemedText style={[styles.legendText, { color: mutedColor }]}>Available</ThemedText>
            </View>
            <ThemedText style={[styles.legendText, { color: mutedColor }]}>
              Tap a booked cell to view details
            </ThemedText>
          </View>

          {gridLoading ? (
            <ActivityIndicator style={{ padding: 40 }} size="large" color={COLORS.primary} />
          ) : (
            <AvailabilityGrid
              sections={gridSections}
              bookings={gridBookings}
              isDark={isDark}
              onBookingPress={(b) => router.push(`/(admin)/bookings/${b.id}`)}
            />
          )}
        </View>
      ) : sorted.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={40} color={mutedColor} />
          <ThemedText style={[styles.emptyText, { color: mutedColor }]}>
            No bookings found
          </ThemedText>
        </View>
      ) : isWide ? (
        /* ── Table view ── */
        <View style={[styles.tableCard, { backgroundColor: cardBg, borderColor }]}>
          <View style={[styles.tableHeader, { backgroundColor: headerBg }]}>
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
                { cursor: "pointer" } as const, // Cast required for web only style
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
              <View style={styles.colGuest}>
                <ThemedText style={styles.tdGuest} numberOfLines={1}>
                  {b.customerEmail}
                </ThemedText>
                <ThemedText style={[styles.tdNotes, { color: mutedColor }]} numberOfLines={1}>
                  {b.specialRequests || "No special requests"}
                </ThemedText>
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
                {statusFilter === "cancelled" ? (
                  <View style={[styles.badge, { backgroundColor: "rgba(220,38,38,0.1)" }]}>
                    <ThemedText style={[styles.badgeText, { color: "#dc2626" }]}>
                      Cancelled
                    </ThemedText>
                  </View>
                ) : statusFilter === "past" ? (
                  <View style={[styles.badge, { backgroundColor: isDark ? "#1a1c1e" : "#f1f5f9" }]}>
                    <ThemedText
                      style={[styles.badgeText, { color: isDark ? "#64748b" : "#94a3b8" }]}
                    >
                      Past
                    </ThemedText>
                  </View>
                ) : (
                  <StatusBadge date={b.date} isDark={isDark} />
                )}
              </View>
              <View style={styles.colAction}>
                <Pressable
                  style={[styles.rowActionBtn, { backgroundColor: `${COLORS.primary}14` }]}
                  onPress={(e) => {
                    (e as { stopPropagation?: () => void }).stopPropagation?.();
                    router.push(`/(admin)/bookings/${b.id}`);
                  }}
                >
                  <Ionicons name="eye-outline" size={14} color={COLORS.primary} />
                </Pressable>
                {statusFilter === "active" && (
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
        /* ── Card list (mobile) ── */
        <View style={styles.cardList}>
          {sorted.map((b) => (
            <Pressable
              key={b.id}
              style={[styles.listCard, { backgroundColor: cardBg, borderColor }]}
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
                  <ThemedText style={styles.tdGuest} numberOfLines={1}>
                    {b.customerEmail}
                  </ThemedText>
                  <View style={styles.partyPill}>
                    <Ionicons name="people-outline" size={12} color={mutedColor} />
                    <ThemedText style={[styles.tdDate, { color: mutedColor }]}>
                      {b.seats} guests
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.listCardRight}>
                  <StatusBadge date={b.date} isDark={isDark} />
                  <Ionicons
                    name="chevron-forward-outline"
                    size={16}
                    color={mutedColor}
                    style={{ marginTop: 10 }}
                  />
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      )}
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
