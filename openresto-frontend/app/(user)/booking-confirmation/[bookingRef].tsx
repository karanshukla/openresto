import { ThemedText } from "@/components/themed-text";
import { getBookingByRef, getBookingById, cancelBookingByRef, BookingDto } from "@/api/bookings";
import { fetchRestaurantById, RestaurantDto } from "@/api/restaurants";
import { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { BORDER_RADIUS, BUTTON_SIZES, SHADOWS, SPACING, TYPOGRAPHY, COLORS } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import PageContainer from "@/components/layout/PageContainer";
import CalendarActions from "@/components/booking/CalendarActions";
import BookingDetailRows from "@/components/booking/BookingDetailRows";
import BookingConfirmationSkeleton from "@/components/booking/BookingConfirmationSkeleton";
import ConfirmModal from "@/components/common/ConfirmModal";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function BookingConfirmationScreen() {
  const { bookingRef, email } = useLocalSearchParams<{ bookingRef: string; email: string }>();
  const [booking, setBooking] = useState<BookingDto | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const router = useRouter();
  const { colors, primaryColor, isDark } = useAppTheme();
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 768;

  useEffect(() => {
    if (!bookingRef) return;
    let cancelled = false;
    async function load() {
      const numericId = /^\d+$/.test(bookingRef) ? parseInt(bookingRef, 10) : NaN;
      const data = isNaN(numericId)
        ? await getBookingByRef(bookingRef, email ?? "")
        : await getBookingById(numericId);
      if (cancelled) return;
      setBooking(data);
      if (data?.restaurantId) {
        const r = await fetchRestaurantById(data.restaurantId);
        if (cancelled) return;
        setRestaurant(r);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [bookingRef, email]);

  if (loading) {
    return (
      <>
        {Platform.OS !== "web" && <Stack.Screen options={{ title: "Booking Confirmation" }} />}
        <BookingConfirmationSkeleton />
      </>
    );
  }

  if (!booking) {
    return (
      <View style={[styles.center, { backgroundColor: colors.page }]}>
        {Platform.OS !== "web" && <Stack.Screen options={{ title: "Not Found" }} />}
        <Ionicons name="alert-circle-outline" size={40} color={colors.muted} />
        <ThemedText style={[styles.notFoundText, { color: colors.muted }]}>
          Booking not found.
        </ThemedText>
        <Pressable
          style={[styles.retryBtn, { borderColor: colors.border }]}
          onPress={() => router.replace("/")}
        >
          <ThemedText style={[styles.retryBtnText, { color: primaryColor }]}>
            Back to Home
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  const ref = booking.bookingRef ?? bookingRef;
  const restaurantName = restaurant?.name ?? "Restaurant";

  const handleCancelBooking = async () => {
    if (!booking?.bookingRef) return;
    setCancelling(true);
    try {
      const ok = await cancelBookingByRef(booking.bookingRef, booking.customerEmail ?? "");
      if (ok) {
        setBooking((prev) => (prev ? { ...prev, isCancelled: true } : prev));
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
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.page }}
      contentContainerStyle={styles.scrollContent}
    >
      {Platform.OS !== "web" && <Stack.Screen options={{ title: "Booking Confirmed" }} />}
      <PageContainer>
        {/* Header — same spacing pattern as lookup page */}
        <View style={styles.header}>
          <View style={[styles.checkCircle, { backgroundColor: primaryColor }]}>
            <Ionicons name="checkmark" size={32} color={COLORS.white} />
          </View>
          <ThemedText style={styles.title}>Booking Confirmed</ThemedText>
          <ThemedText style={[styles.subtitle, { color: colors.muted }]}>
            {booking.customerName ? `${booking.customerName}, ` : ""}
            {booking.seats} {booking.seats === 1 ? "guest" : "guests"} at {restaurantName}
          </ThemedText>
        </View>

        {/* Two-column on wide: [details] | [ref card + calendar] */}
        <View style={isWide ? styles.wideRow : styles.narrowGap}>
          {/* Left / top on narrow: detail rows */}
          <View
            style={[
              styles.detailCard,
              { backgroundColor: colors.card, borderColor: colors.border },
              isWide && styles.wideCol,
            ]}
          >
            <BookingDetailRows
              booking={booking}
              restaurant={restaurant}
              mutedColor={colors.muted}
              borderColor={colors.border}
            />
          </View>

          {/* Right / bottom on narrow: ref card + calendar + directions stacked */}
          <View style={[isWide && styles.wideCol, styles.rightCol]}>
            <View
              style={[styles.refCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <ThemedText style={[styles.refLabel, { color: colors.muted }]}>
                Booking Reference
              </ThemedText>
              <View style={styles.refRow}>
                <View
                  style={[
                    styles.refBadge,
                    { backgroundColor: isDark ? `${primaryColor}22` : `${primaryColor}14` },
                  ]}
                >
                  <ThemedText style={[styles.refValue, { color: primaryColor }]}>{ref}</ThemedText>
                </View>
                {Platform.OS === "web" && (
                  <Pressable
                    style={[styles.copyBtn, { borderColor: colors.border }]}
                    onPress={() => {
                      navigator.clipboard.writeText(ref);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    <Ionicons
                      name={copied ? "checkmark" : "copy-outline"}
                      size={14}
                      color={copied ? COLORS.success : primaryColor}
                    />
                    <ThemedText
                      style={[
                        styles.copyBtnText,
                        { color: copied ? COLORS.success : primaryColor },
                      ]}
                    >
                      {copied ? "Copied" : "Copy"}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
              <ThemedText style={[styles.refHint, { color: colors.muted }]}>
                Use this reference and your email to look up your booking
              </ThemedText>
            </View>

            {Platform.OS === "web" && ref && (
              <View
                style={[
                  styles.actionCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <CalendarActions
                  bookingRef={ref}
                  date={booking.date}
                  seats={booking.seats}
                  specialRequests={booking.specialRequests}
                  restaurantName={restaurantName}
                  restaurantAddress={restaurant?.address ?? ""}
                  variant="full"
                />
              </View>
            )}

            <View
              style={[
                styles.actionCard,
                styles.directionsCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              {restaurant?.address && (
                <>
                  <ThemedText style={[styles.refLabel, { color: colors.muted }]}>
                    Get Directions
                  </ThemedText>
                  <View style={styles.mapMeta}>
                    <Ionicons name="location-outline" size={13} color={colors.muted} />
                    <ThemedText
                      style={[styles.mapAddress, { color: colors.muted }]}
                      numberOfLines={2}
                    >
                      {restaurant.address}
                    </ThemedText>
                  </View>
                  <View style={styles.mapLinks}>
                    <Pressable
                      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                        styles.mapLink,
                        {
                          backgroundColor: isDark ? colors.border : `${primaryColor}0f`,
                          borderColor: hovered || pressed ? primaryColor : colors.border,
                        },
                      ]}
                      onPress={() =>
                        Linking.openURL(
                          `https://maps.google.com/?q=${encodeURIComponent(restaurant.address!)}`
                        )
                      }
                      accessibilityLabel="Open in Google Maps"
                    >
                      <Ionicons name="navigate-outline" size={13} color={colors.muted} />
                      <ThemedText style={[styles.mapLinkText, { color: colors.muted }]}>
                        Google
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                        styles.mapLink,
                        {
                          backgroundColor: isDark ? colors.border : `${primaryColor}0f`,
                          borderColor: hovered || pressed ? primaryColor : colors.border,
                        },
                      ]}
                      onPress={() =>
                        Linking.openURL(
                          `https://maps.apple.com/?q=${encodeURIComponent(restaurant.address!)}`
                        )
                      }
                      accessibilityLabel="Open in Apple Maps"
                    >
                      <Ionicons name="navigate-outline" size={13} color={colors.muted} />
                      <ThemedText style={[styles.mapLinkText, { color: colors.muted }]}>
                        Apple
                      </ThemedText>
                    </Pressable>
                  </View>
                  <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />
                </>
              )}

              {!booking.isCancelled ? (
                <Pressable
                  style={styles.cancelBtn}
                  onPress={() => setShowCancelConfirm(true)}
                  disabled={cancelling}
                >
                  <Ionicons name="trash-outline" size={15} color={COLORS.error} />
                  <ThemedText style={styles.cancelBtnText}>Cancel This Booking</ThemedText>
                </Pressable>
              ) : (
                <View style={styles.cancelledNote}>
                  <Ionicons name="close-circle" size={15} color={COLORS.error} />
                  <ThemedText style={[styles.cancelBtnText, { opacity: 0.7 }]}>
                    This booking has been cancelled
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        </View>
      </PageContainer>

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, paddingBottom: 60 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 },
  notFoundText: { fontSize: 16, marginTop: 8 },
  retryBtn: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xsm,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
  },
  retryBtnText: { fontSize: 14, fontWeight: "600" },

  // Header — mirrors lookup page
  header: { alignItems: "center", gap: 8, marginTop: 8, marginBottom: 20 },
  checkCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.6, marginTop: 8 },
  subtitle: { fontSize: 15, textAlign: "center", lineHeight: 22 },

  // Two-column layout
  wideRow: { flexDirection: "row", gap: SPACING.xl, alignItems: "stretch" },
  narrowGap: { gap: SPACING.lg },
  wideCol: { flex: 1 },
  rightCol: { gap: SPACING.lg, flexDirection: "column" },

  // Detail rows card
  detailCard: {
    borderRadius: BORDER_RADIUS.card,
    borderWidth: 1,
    overflow: "hidden",
    ...SHADOWS.md,
  },

  // Reference card
  refCard: {
    borderRadius: BORDER_RADIUS.card,
    borderWidth: 1,
    padding: SPACING.xxl,
    alignItems: "center",
    gap: SPACING.md,
    ...SHADOWS.md,
  },
  refLabel: {
    ...TYPOGRAPHY.labelSmall,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  refRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xsm,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  refBadge: { ...BUTTON_SIZES.secondary, borderRadius: BORDER_RADIUS.lg },
  refValue: { ...TYPOGRAPHY.h2, fontWeight: "800" },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACING.xsm,
    paddingVertical: SPACING.xxs,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  copyBtnText: { ...TYPOGRAPHY.caption, fontWeight: "600" },
  refHint: { ...TYPOGRAPHY.caption, textAlign: "center" },
  savedNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingTop: SPACING.sm,
    marginTop: SPACING.xsm,
    borderTopWidth: 1,
  },
  savedNoteText: { ...TYPOGRAPHY.caption, opacity: 0.75 },

  // Calendar card
  actionCard: {
    borderRadius: BORDER_RADIUS.card,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.xsm,
    ...SHADOWS.md,
  },

  directionsCard: { gap: SPACING.sm, flex: 1 },
  cardDivider: { height: 1, marginVertical: SPACING.xsm },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: SPACING.sm,
  },
  cancelBtnText: { color: COLORS.error, ...TYPOGRAPHY.bodyBold },
  cancelledNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: SPACING.sm,
  },
  // Directions card — same pill style as restaurant card homepage
  mapMeta: { flexDirection: "row", alignItems: "flex-start", gap: 5, marginBottom: 4 },
  mapAddress: { fontSize: 13, flex: 1, lineHeight: 18 },
  mapLinks: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  mapLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  mapLinkText: { fontSize: 12.5, fontWeight: "600" },
});
