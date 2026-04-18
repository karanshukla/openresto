import { ThemedText } from "@/components/themed-text";
import { getBookingByRef, BookingDto, cancelBookingByRef } from "@/api/bookings";
import { fetchRestaurantById, RestaurantDto } from "@/api/restaurants";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Input from "@/components/common/Input";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { BUTTON_SIZES, COLORS, getThemeColors } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import PageContainer from "@/components/layout/PageContainer";
import { CachedBooking, fetchCachedBookings } from "@/utils/bookingCache";
import { useBrand } from "@/context/BrandContext";
import ConfirmModal from "@/components/common/ConfirmModal";
import CalendarActions from "@/components/booking/CalendarActions";
import BookingDetailRows from "@/components/booking/BookingDetailRows";

export default function LookupScreen() {
  const [refInput, setRefInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [booking, setBooking] = useState<BookingDto | null | undefined>(undefined);
  const [restaurant, setRestaurant] = useState<RestaurantDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [cached, setCached] = useState<CachedBooking[]>([]);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const isDark = useColorScheme() === "dark";
  const brand = useBrand();
  const accent = brand.primaryColor || "#0a7ea4";
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 768;
  const colors = getThemeColors(isDark);
  const borderColor = colors.border;
  const canSearch = refInput.trim() && emailInput.trim();

  useEffect(() => {
    let cancelled = false;
    fetchCachedBookings().then((data) => {
      if (cancelled) return;
      setCached(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const performLookup = async (ref: string, email: string) => {
    setLoading(true);
    setSearched(true);
    setRestaurant(null);
    try {
      const result = await getBookingByRef(ref, email);
      setBooking(result);
      if (result?.restaurantId) {
        const r = await fetchRestaurantById(result.restaurantId);
        setRestaurant(r);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLookup = () => {
    const ref = refInput.trim();
    const email = emailInput.trim();
    if (!ref || !email) return;
    performLookup(ref, email);
  };

  const handleCancelBooking = async () => {
    if (!booking?.bookingRef) return;
    setCancelling(true);
    try {
      const ok = await cancelBookingByRef(booking.bookingRef, booking.customerEmail);
      if (ok) {
        await performLookup(booking.bookingRef, booking.customerEmail);
        setShowCancelConfirm(false);
      } else if (Platform.OS === "web") {
        window.alert("Failed to cancel booking. Please try again or contact the restaurant.");
      } else {
        Alert.alert("Error", "Failed to cancel booking. Please try again.");
      }
    } finally {
      setCancelling(false);
    }
  };

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.page }]}
      contentContainerStyle={styles.scrollContent}
    >
      <PageContainer>
        <View style={styles.header}>
          <Ionicons name="search-outline" size={32} color={accent} />
          <ThemedText style={styles.title}>Find My Booking</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.muted }]}>
            Enter your booking reference and email to look up your reservation.
          </ThemedText>
        </View>

        <View style={isWide ? styles.wideRow : undefined}>
          <View style={isWide ? styles.wideCol : undefined}>
            <SearchForm
              refInput={refInput}
              emailInput={emailInput}
              onRefChange={setRefInput}
              onEmailChange={setEmailInput}
              onSubmit={handleLookup}
              canSearch={!!canSearch}
              loading={loading}
              accent={accent}
              colors={colors}
              borderColor={borderColor}
            />
            {isWide && (
              <RecentBookings
                cached={cached}
                colors={colors}
                borderColor={borderColor}
                onSelect={(c) => {
                  setRefInput(c.bookingRef);
                  setEmailInput(c.email);
                  performLookup(c.bookingRef, c.email);
                }}
              />
            )}
          </View>

          <View style={isWide ? styles.wideCol : undefined}>
            {!loading && searched && !booking && (
              <View
                style={[
                  styles.resultCard,
                  { backgroundColor: colors.card, borderColor },
                  isWide ? { marginTop: 0 } : { marginTop: 16 },
                ]}
              >
                <Ionicons name="alert-circle-outline" size={28} color={colors.muted} />
                <ThemedText style={[styles.notFound, { color: colors.muted }]}>
                  No booking found matching that reference and email.
                </ThemedText>
              </View>
            )}

            {!loading && booking && (
              <BookingResult
                booking={booking}
                restaurant={restaurant}
                isDark={isDark}
                accent={accent}
                colors={colors}
                borderColor={borderColor}
                isWide={isWide}
                onCancel={() => setShowCancelConfirm(true)}
              />
            )}
          </View>
        </View>

        {!isWide && (
          <RecentBookings
            cached={cached}
            colors={colors}
            borderColor={borderColor}
            style={{ marginTop: 20 }}
            onSelect={(c) => {
              setRefInput(c.bookingRef);
              setEmailInput(c.email);
              performLookup(c.bookingRef, c.email);
            }}
          />
        )}

        <ConfirmModal
          visible={showCancelConfirm}
          title="Cancel Reservation"
          message="Are you sure you want to cancel this booking? This action cannot be undone."
          confirmLabel={cancelling ? "Cancelling..." : "Cancel Booking"}
          cancelLabel="Keep Booking"
          destructive
          onConfirm={handleCancelBooking}
          onCancel={() => !cancelling && setShowCancelConfirm(false)}
        />
      </PageContainer>
    </ScrollView>
  );
}

function SearchForm({
  refInput,
  emailInput,
  onRefChange,
  onEmailChange,
  onSubmit,
  canSearch,
  loading,
  accent,
  colors,
  borderColor,
}: {
  refInput: string;
  emailInput: string;
  onRefChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onSubmit: () => void;
  canSearch: boolean;
  loading: boolean;
  accent: string;
  colors: ReturnType<typeof getThemeColors>;
  borderColor: string;
}) {
  return (
    <View style={[styles.searchCard, { backgroundColor: colors.card, borderColor }]}>
      <ThemedText style={styles.label}>Booking Reference</ThemedText>
      <Input
        placeholder="e.g. crispy-basil-thyme"
        value={refInput}
        onChangeText={onRefChange}
        autoCapitalize="none"
      />
      <ThemedText style={styles.label}>Email Address</ThemedText>
      <Input
        placeholder="The email used when booking"
        value={emailInput}
        onChangeText={onEmailChange}
        autoCapitalize="none"
        keyboardType="email-address"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />
      <Pressable
        onPress={onSubmit}
        disabled={!canSearch || loading}
        style={[
          styles.searchBtn,
          { backgroundColor: accent },
          (!canSearch || loading) && { opacity: 0.5 },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="search" size={16} color="#fff" />
            <ThemedText style={styles.searchBtnText}>Look Up</ThemedText>
          </>
        )}
      </Pressable>
      <ThemedText style={[styles.helpText, { color: colors.muted }]}>
        Can&apos;t find your booking? Contact the restaurant directly.
      </ThemedText>
    </View>
  );
}

function RecentBookings({
  cached,
  colors,
  borderColor,
  style,
  onSelect,
}: {
  cached: CachedBooking[];
  colors: ReturnType<typeof getThemeColors>;
  borderColor: string;
  style?: object;
  onSelect: (c: CachedBooking) => void;
}) {
  if (cached.length === 0) return null;
  return (
    <View style={[styles.recentSection, style]}>
      <ThemedText style={[styles.recentTitle, { color: colors.muted }]}>
        YOUR RECENT BOOKINGS
      </ThemedText>
      {cached.map((c) => (
        <Pressable
          key={c.bookingRef}
          style={[styles.recentCard, { backgroundColor: colors.card, borderColor }]}
          onPress={() => onSelect(c)}
        >
          <View style={styles.recentCardRow}>
            <View style={{ flex: 1, gap: 3 }}>
              <ThemedText style={styles.recentRef}>{c.bookingRef}</ThemedText>
              <ThemedText style={[styles.recentMeta, { color: colors.muted }]}>
                {c.restaurantName ? `${c.restaurantName} · ` : ""}
                {new Date(c.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                {" · "}
                {c.seats} guest{c.seats !== 1 ? "s" : ""}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward-outline" size={16} color={colors.muted} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function BookingResult({
  booking,
  restaurant,
  isDark,
  accent,
  colors,
  borderColor,
  isWide,
  onCancel,
}: {
  booking: BookingDto;
  restaurant: RestaurantDto | null;
  isDark: boolean;
  accent: string;
  colors: ReturnType<typeof getThemeColors>;
  borderColor: string;
  isWide: boolean;
  onCancel: () => void;
}) {
  return (
    <View
      style={[
        styles.detailCard,
        { backgroundColor: colors.card, borderColor },
        isWide ? {} : { marginTop: 24 },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.resultHeader}>
          <Ionicons
            name={booking.isCancelled ? "close-circle" : "checkmark-circle"}
            size={20}
            color={booking.isCancelled ? COLORS.error : "#16a34a"}
          />
          <ThemedText style={styles.resultTitle}>
            {booking.isCancelled ? "Booking Cancelled" : "Booking Found"}
          </ThemedText>
        </View>
        <View
          style={[styles.refBadge, { backgroundColor: isDark ? `${accent}22` : `${accent}14` }]}
        >
          <ThemedText style={[styles.refText, { color: accent }]}>{booking.bookingRef}</ThemedText>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: borderColor }]} />

      {Platform.OS === "web" && booking.bookingRef && (
        <>
          <CalendarActions
            bookingRef={booking.bookingRef}
            date={booking.date}
            seats={booking.seats}
            specialRequests={booking.specialRequests}
            restaurantName={restaurant?.name ?? "Restaurant"}
            restaurantAddress={restaurant?.address ?? ""}
            variant="compact"
          />
          <View style={[styles.divider, { backgroundColor: borderColor }]} />
        </>
      )}

      <BookingDetailRows
        booking={booking}
        restaurant={restaurant}
        mutedColor={colors.muted}
        borderColor={borderColor}
      />

      {!booking.isCancelled && (
        <>
          <View style={[styles.divider, { backgroundColor: borderColor }]} />
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Ionicons name="trash-outline" size={15} color={COLORS.error} />
            <ThemedText style={styles.cancelBtnText}>Cancel This Booking</ThemedText>
          </Pressable>
        </>
      )}

      {booking.isCancelled && (
        <>
          <View style={[styles.divider, { backgroundColor: borderColor }]} />
          <View style={styles.cancelledContent}>
            <Ionicons name="close-circle" size={15} color={COLORS.error} />
            <ThemedText style={[styles.cancelledText, { color: COLORS.error }]}>
              This booking has been cancelled.
            </ThemedText>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 60 },
  header: { alignItems: "center", gap: 8, marginTop: 48, marginBottom: 32 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.6, marginTop: 8 },
  subtitle: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  wideRow: { flexDirection: "row", gap: 24, alignItems: "flex-start" },
  wideCol: { flex: 1 },
  searchCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    gap: 12,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  label: { fontSize: 13, fontWeight: "600", letterSpacing: 0.2 },
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...BUTTON_SIZES.primary,
    borderRadius: 10,
    marginTop: 4,
  },
  searchBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  helpText: { fontSize: 12, textAlign: "center", lineHeight: 18, marginTop: 4 },
  resultCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 24,
    marginTop: 20,
    width: "100%",
    alignItems: "center",
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  notFound: { fontSize: 15, textAlign: "center" },
  detailCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
  },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  resultTitle: { fontSize: 18, fontWeight: "700" },
  refBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  refText: { fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },
  divider: { height: 1 },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cancelBtnText: { color: COLORS.error, fontSize: 15, fontWeight: "600" },
  cancelledContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cancelledText: { fontSize: 15, fontWeight: "600" },
  recentSection: { marginTop: 20, gap: 10, width: "100%" },
  recentTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 2 },
  recentCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  recentCardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  recentRef: { fontSize: 14, fontWeight: "700", letterSpacing: -0.2, flex: 1 },
  recentMeta: { fontSize: 12 },
});
