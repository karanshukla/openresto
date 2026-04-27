import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
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
import { BUTTON_SIZES, COLORS } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import PageContainer from "@/components/layout/PageContainer";
import { CachedBooking, fetchCachedBookings } from "@/utils/bookingCache";
import ConfirmModal from "@/components/common/ConfirmModal";
import CalendarActions from "@/components/booking/CalendarActions";
import BookingDetailRows from "@/components/booking/BookingDetailRows";
import { useAppTheme } from "@/hooks/use-app-theme";

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

  const { width } = useWindowDimensions();
  const { colors, primaryColor, isDark } = useAppTheme();

  const isWide = Platform.OS === "web" && width >= 768;
  const canSearch = refInput.trim() && emailInput.trim();

  useEffect(() => {
    fetchCachedBookings().then(setCached);
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
        window.alert("Failed to cancel booking.");
      } else {
        Alert.alert("Error", "Failed to cancel booking.");
      }
    } finally {
      setCancelling(false);
    }
  };

  return (
    <ThemedView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <PageContainer>
          <View style={styles.header}>
            <Ionicons name="search-outline" size={32} color={primaryColor} />
            <ThemedText style={styles.title}>Find My Booking</ThemedText>
            <ThemedText style={StyleSheet.flatten([styles.subtitle, { color: colors.muted }])}>
              Enter your booking reference and email to look up your reservation.
            </ThemedText>
          </View>

          <View style={isWide ? styles.wideRow : undefined}>
            <View style={isWide ? styles.wideCol : undefined}>
              <View
                style={StyleSheet.flatten([
                  styles.searchCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ])}
              >
                <ThemedText style={styles.label}>Booking Reference</ThemedText>
                <Input
                  placeholder="e.g. crispy-basil-thyme"
                  value={refInput}
                  onChangeText={setRefInput}
                  autoCapitalize="none"
                />
                <ThemedText style={styles.label}>Email Address</ThemedText>
                <Input
                  placeholder="The email used when booking"
                  value={emailInput}
                  onChangeText={setEmailInput}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="go"
                  onSubmitEditing={handleLookup}
                />
                <Pressable
                  onPress={handleLookup}
                  disabled={!canSearch || loading}
                  style={StyleSheet.flatten([
                    styles.searchBtn,
                    { backgroundColor: primaryColor },
                    (!canSearch || loading) && { opacity: 0.5 },
                  ])}
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
                <ThemedText style={StyleSheet.flatten([styles.helpText, { color: colors.muted }])}>
                  Can&apos;t find your booking? Contact the restaurant directly.
                </ThemedText>
              </View>

              {isWide && (
                <RecentBookingsList
                  cached={cached}
                  colors={colors}
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
                  style={StyleSheet.flatten([
                    styles.resultCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    isWide ? { marginTop: 0 } : { marginTop: 16 },
                  ])}
                >
                  <Ionicons name="alert-circle-outline" size={28} color={colors.muted} />
                  <ThemedText
                    style={StyleSheet.flatten([styles.notFound, { color: colors.muted }])}
                  >
                    No booking found matching that reference and email.
                  </ThemedText>
                </View>
              )}

              {!loading && booking && (
                <BookingResultCard
                  booking={booking}
                  restaurant={restaurant}
                  primaryColor={primaryColor}
                  colors={colors}
                  isDark={isDark}
                  isWide={isWide}
                  onCancel={() => setShowCancelConfirm(true)}
                />
              )}
            </View>
          </View>

          {!isWide && (
            <RecentBookingsList
              cached={cached}
              colors={colors}
              style={{ marginTop: 20 }}
              onSelect={(c) => {
                setRefInput(c.bookingRef);
                setEmailInput(c.email);
                performLookup(c.bookingRef, c.email);
              }}
            />
          )}
        </PageContainer>
      </ScrollView>

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
    </ThemedView>
  );
}

function RecentBookingsList({ cached, colors, style, onSelect }: any) {
  if (cached.length === 0) return null;
  return (
    <View style={StyleSheet.flatten([styles.recentSection, style])}>
      <ThemedText style={StyleSheet.flatten([styles.recentTitle, { color: colors.muted }])}>
        YOUR RECENT BOOKINGS
      </ThemedText>
      {cached.map((c: any) => (
        <Pressable
          key={c.bookingRef}
          style={StyleSheet.flatten([
            styles.recentCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ])}
          onPress={() => onSelect(c)}
        >
          <View style={styles.recentCardRow}>
            <View style={{ flex: 1, gap: 3 }}>
              <ThemedText style={styles.recentRef}>{c.bookingRef}</ThemedText>
              <ThemedText style={StyleSheet.flatten([styles.recentMeta, { color: colors.muted }])}>
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

function BookingResultCard({
  booking,
  restaurant,
  primaryColor,
  colors,
  isDark,
  isWide,
  onCancel,
}: any) {
  return (
    <View
      style={StyleSheet.flatten([
        styles.detailCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        isWide ? {} : { marginTop: 24 },
      ])}
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
          style={StyleSheet.flatten([
            styles.refBadge,
            { backgroundColor: isDark ? `${primaryColor}22` : `${primaryColor}14` },
          ])}
        >
          <ThemedText style={StyleSheet.flatten([styles.refText, { color: primaryColor }])}>
            {booking.bookingRef}
          </ThemedText>
        </View>
      </View>

      <View style={StyleSheet.flatten([styles.divider, { backgroundColor: colors.border }])} />

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
          <View style={StyleSheet.flatten([styles.divider, { backgroundColor: colors.border }])} />
        </>
      )}

      <BookingDetailRows
        booking={booking}
        restaurant={restaurant}
        mutedColor={colors.muted}
        borderColor={colors.border}
      />

      {!booking.isCancelled && (
        <>
          <View style={StyleSheet.flatten([styles.divider, { backgroundColor: colors.border }])} />
          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Ionicons name="trash-outline" size={15} color={COLORS.error} />
            <ThemedText style={styles.cancelBtnText}>Cancel This Booking</ThemedText>
          </Pressable>
        </>
      )}

      {booking.isCancelled && (
        <>
          <View style={StyleSheet.flatten([styles.divider, { backgroundColor: colors.border }])} />
          <View style={styles.cancelledContent}>
            <Ionicons name="close-circle" size={15} color={COLORS.error} />
            <ThemedText style={StyleSheet.flatten([styles.cancelledText, { color: COLORS.error }])}>
              This booking has been cancelled.
            </ThemedText>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  header: { alignItems: "center", gap: 8, marginTop: 24, marginBottom: 32 },
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
