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
import { COLORS, STATUS_COLORS, BUTTON_SIZES, getThemeColors } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = "list" | "grid";
type BadgeVariant = "arrived" | "seated" | "upcoming" | "scheduled" | "completed";

// ── Time slots for the grid (11 AM – 10 PM) ──────────────────────────────────

const TIME_SLOTS = Array.from({ length: 12 }, (_, i) => {
  const h = i + 11;
  const label = h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`;
  return { hour: h, label };
});

const COL_W = 68; // px per time-slot column
const ROW_H = 48; // px per table row
const LABEL_W = 110; // px for the fixed left label column

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function isoDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function getStatus(date: string): { label: string; variant: BadgeVariant } {
  const d = new Date(date);
  const now = new Date();
  const diffMins = (d.getTime() - now.getTime()) / 60000;
  if (diffMins < -90) return { label: "Completed", variant: "completed" };
  if (diffMins < -15) return { label: "Seated", variant: "seated" };
  if (diffMins < 5) return { label: "Arrived", variant: "arrived" };
  if (diffMins < 60) return { label: "Upcoming", variant: "upcoming" };
  return { label: "Scheduled", variant: "scheduled" };
}

const BADGE_STYLES: Record<
  BadgeVariant,
  { bg: string; text: string; darkBg?: string; darkText?: string }
> = {
  arrived: { bg: STATUS_COLORS.arrived.bg.light, text: STATUS_COLORS.arrived.text, darkBg: STATUS_COLORS.arrived.bg.dark, darkText: "#4ade80" },
  seated: { bg: STATUS_COLORS.seated.bg.light, text: STATUS_COLORS.seated.text },
  upcoming: { bg: STATUS_COLORS.upcoming.bg.light, text: STATUS_COLORS.upcoming.text, darkBg: STATUS_COLORS.upcoming.bg.dark, darkText: "#fde047" },
  scheduled: { bg: STATUS_COLORS.scheduled.bg.light, text: STATUS_COLORS.scheduled.text, darkBg: STATUS_COLORS.scheduled.bg.dark, darkText: "#94a3b8" },
  completed: { bg: STATUS_COLORS.completed.bg.light, text: STATUS_COLORS.completed.text, darkBg: STATUS_COLORS.completed.bg.dark, darkText: "#64748b" },
};

function StatusBadge({ date, isDark }: { date: string; isDark: boolean }) {
  const { label, variant } = getStatus(date);
  const s = BADGE_STYLES[variant];
  const bg = isDark && s.darkBg ? s.darkBg : s.bg;
  const text = isDark && s.darkText ? s.darkText : s.text;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <ThemedText style={[styles.badgeText, { color: text }]}>{label}</ThemedText>
    </View>
  );
}

// ── Availability Grid ─────────────────────────────────────────────────────────

const HEADER_H = 36;
const SECTION_H = 26;

function AvailabilityGrid({
  sections,
  bookings,
  isDark,
  onBookingPress,
}: {
  sections: SectionWithTables[];
  bookings: BookingDetailDto[];
  isDark: boolean;
  onBookingPress: (b: BookingDetailDto) => void;
}) {
  const colors = getThemeColors(isDark);
  const borderColor = colors.border;
  const headerBg = isDark ? "#28292b" : "#f4f5f6";
  const sectionBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";
  const availBg = isDark ? "#18191b" : "#fafafa";
  const bookedBg = isDark ? `rgba(${parseInt(COLORS.error.slice(1, 3), 16)},${parseInt(COLORS.error.slice(3, 5), 16)},${parseInt(COLORS.error.slice(5, 7), 16)},0.22)` : `rgba(${parseInt(COLORS.error.slice(1, 3), 16)},${parseInt(COLORS.error.slice(3, 5), 16)},${parseInt(COLORS.error.slice(5, 7), 16)},0.1)`;
  const mutedColor = colors.muted;

  function bookingForCell(tableId: number, hour: number): BookingDetailDto | undefined {
    return bookings.find((b) => b.tableId === tableId && new Date(b.date).getHours() === hour);
  }

  const totalW = LABEL_W + TIME_SLOTS.length * COL_W;

  if (sections.length === 0) {
    return (
      <View style={{ padding: 40, alignItems: "center" }}>
        <Ionicons name="grid-outline" size={32} color={mutedColor} />
        <ThemedText style={[{ color: mutedColor, marginTop: 10, fontSize: 14 }]}>
          No tables found. Add sections and tables in Location Manager.
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={{ width: totalW }}>
        {/* Column headers */}
        <View
          style={[
            {
              flexDirection: "row",
              height: HEADER_H,
              backgroundColor: headerBg,
              borderBottomWidth: 1,
              borderBottomColor: borderColor,
            },
          ]}
        >
          <View
            style={[
              {
                width: LABEL_W,
                height: HEADER_H,
                justifyContent: "center",
                paddingHorizontal: 10,
                borderRightWidth: 1,
                borderRightColor: borderColor,
              },
            ]}
          >
            <ThemedText style={[styles.gridHeaderText, { color: mutedColor }]}>TABLE</ThemedText>
          </View>
          {TIME_SLOTS.map(({ hour, label }) => (
            <View
              key={hour}
              style={[
                {
                  width: COL_W,
                  height: HEADER_H,
                  alignItems: "center",
                  justifyContent: "center",
                  borderLeftWidth: 1,
                  borderLeftColor: borderColor,
                },
              ]}
            >
              <ThemedText style={[styles.gridHeaderText, { color: mutedColor }]}>
                {label}
              </ThemedText>
            </View>
          ))}
        </View>

        {/* Sections + table rows */}
        {sections.map((section) => (
          <View key={section.id}>
            {/* Section divider */}
            <View
              style={[
                {
                  height: SECTION_H,
                  flexDirection: "row",
                  backgroundColor: sectionBg,
                  borderBottomWidth: 1,
                  borderBottomColor: borderColor,
                  alignItems: "center",
                  paddingHorizontal: 10,
                },
              ]}
            >
              <ThemedText style={[styles.gridSectionLabel, { color: mutedColor }]}>
                {section.name.toUpperCase()}
              </ThemedText>
            </View>

            {/* Table rows */}
            {section.tables.map((table) => (
              <View
                key={table.id}
                style={[
                  {
                    flexDirection: "row",
                    height: ROW_H,
                    borderBottomWidth: 1,
                    borderBottomColor: borderColor,
                  },
                ]}
              >
                {/* Fixed label */}
                <View
                  style={[
                    {
                      width: LABEL_W,
                      height: ROW_H,
                      justifyContent: "center",
                      paddingHorizontal: 10,
                      borderRightWidth: 1,
                      borderRightColor: borderColor,
                    },
                  ]}
                >
                  <ThemedText style={styles.gridTableName} numberOfLines={1}>
                    {table.name ?? `T${table.id}`}
                  </ThemedText>
                  <ThemedText style={[styles.gridTableSeats, { color: mutedColor }]}>
                    {table.seats}p
                  </ThemedText>
                </View>

                {/* Time slot cells */}
                {TIME_SLOTS.map(({ hour }) => {
                  const booking = bookingForCell(table.id, hour);
                  return (
                    <Pressable
                      key={hour}
                      style={[
                        {
                          width: COL_W,
                          height: ROW_H,
                          alignItems: "center",
                          justifyContent: "center",
                          borderLeftWidth: 1,
                          borderLeftColor: borderColor,
                          paddingHorizontal: 3,
                        },
                        booking
                          ? {
                              backgroundColor: bookedBg,
                              borderLeftColor: "#dc2626",
                              borderLeftWidth: 2,
                            }
                          : { backgroundColor: availBg },
                      ]}
                      onPress={() => booking && onBookingPress(booking)}
                      disabled={!booking}
                    >
                      {booking ? (
                        <View style={{ alignItems: "center", gap: 1 }}>
                          <Ionicons name="person" size={10} color="#dc2626" />
                          <ThemedText style={styles.gridCellEmail} numberOfLines={1}>
                            {booking.customerEmail?.split("@")[0]}
                          </ThemedText>
                          <ThemedText style={[styles.gridCellSeats, { color: mutedColor }]}>
                            {booking.seats}p
                          </ThemedText>
                        </View>
                      ) : (
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                          }}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

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
    fetchRestaurants().then((data) => {
      setRestaurants(data);
      if (data.length > 0) {
        setSelectedRestaurantId(data[0].id);
      }
    });
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

  const todayCount = bookings.filter(
    (b) => new Date(b.date).toDateString() === new Date().toDateString()
  ).length;

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
                    (e as any).stopPropagation?.();
                    router.push(`/(admin)/bookings/${b.id}`);
                  }}
                >
                  <Ionicons name="eye-outline" size={14} color={COLORS.primary} />
                </Pressable>
                {statusFilter === "active" && (
                  <Pressable
                    style={[styles.rowActionBtn, { backgroundColor: "rgba(220,38,38,0.1)" }]}
                    onPress={(e) => {
                      (e as any).stopPropagation?.();
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

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 32,
    gap: 16,
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
  pageTitle: { fontSize: 28, fontWeight: "800", letterSpacing: -0.6 },
  pageSub: { fontSize: 14, marginTop: 2 },
  headerControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  headerSep: { width: 1, height: 24, marginHorizontal: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13 },
  chipTextActive: { color: "#fff", fontWeight: "600", fontSize: 13 },
  // View mode toggle
  modeToggle: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
  },
  modeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modeBtnText: { fontSize: 14, fontWeight: "600" },
  spinner: { marginTop: 40 },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, fontStyle: "italic" },
  // Grid card
  gridCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  gridDateBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  gridNavBtn: { ...BUTTON_SIZES.icon },
  gridDateLabel: { alignItems: "center", gap: 2 },
  gridDateText: { fontSize: 16, fontWeight: "700" },
  gridTodayHint: { fontSize: 11, fontWeight: "600" },
  gridLegend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexWrap: "wrap",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: 12 },
  gridHeaderText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  gridSectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  gridCellEmail: { fontSize: 9, fontWeight: "600", color: "#dc2626", textAlign: "center" },
  gridCellSeats: { fontSize: 9 },
  gridTableName: { fontSize: 12, fontWeight: "600" },
  gridTableSeats: { fontSize: 10 },
  // Table (list)
  tableCard: {
    borderRadius: 14,
    borderWidth: 1,
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
  thCell: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  colTime: { width: 88 },
  colGuest: { flex: 1, paddingHorizontal: 8 },
  colParty: { width: 64, alignItems: "flex-start" },
  colTable: { width: 64 },
  colStatus: { width: 108 },
  colAction: { width: 64, flexDirection: "row", alignItems: "center", gap: 6 },
  tdTime: { fontSize: 14, fontWeight: "700" },
  tdDate: { fontSize: 12, marginTop: 1 },
  tdGuest: { fontSize: 14, fontWeight: "500" },
  tdNotes: { fontSize: 12, marginTop: 1 },
  partyPill: { flexDirection: "row", alignItems: "center", gap: 4 },
  tdParty: { fontSize: 13, fontWeight: "600" },
  tdTableNum: { fontSize: 14 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start" },
  badgeText: { fontSize: 11, fontWeight: "700" },
  rowActionBtn: { padding: 6, borderRadius: 8 },
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
    gap: 12,
  },
  listCardInfo: { flex: 1, gap: 4 },
  listCardRight: { alignItems: "flex-end" },
});
