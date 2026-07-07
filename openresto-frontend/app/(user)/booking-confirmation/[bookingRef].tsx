import { ThemedText } from "@/components/themed-text";
import { getBookingByRef, getBookingById, cancelBookingByRef, BookingDto } from "@/api/bookings";
import { fetchRestaurantById, RestaurantDto } from "@/api/restaurants";
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { theme } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import PageContainer from "@/components/layout/PageContainer";
import CalendarActions from "@/components/booking/CalendarActions";
import BookingDetailRows from "@/components/booking/BookingDetailRows";
import BookingConfirmationSkeleton from "@/components/booking/BookingConfirmationSkeleton";
import ConfirmModal from "@/components/common/ConfirmModal";
import AlertModal from "@/components/common/AlertModal";
import { useAppTheme } from "@/hooks/use-app-theme";
import ScrollToTopFab from "@/components/common/ScrollToTopFab";
import Footer from "@/components/layout/Footer";
import * as Haptics from "expo-haptics";
import { isPast } from "@/components/admin/bookings/StatusBadge";
import { useErrorHandler } from "@/hooks/useErrorHandler";

export default function BookingConfirmationScreen() {
  const { bookingRef, email } = useLocalSearchParams<{ bookingRef: string; email: string }>();
  const [booking, setBooking] = useState<BookingDto | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { errorMessage, showError, clearError } = useErrorHandler();
  const [mapCoords, setMapCoords] = useState<{ lat: number; lng: number } | null>(null);
  const router = useRouter();
  const { colors, primaryColor, isDark } = useAppTheme();
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === "web" && width >= 768;
  const [scrollY, setScrollY] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

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
      if (data) {
        Haptics.notificationAsync(
          data.isCancelled
            ? Haptics.NotificationFeedbackType.Error
            : Haptics.NotificationFeedbackType.Success
        );
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [bookingRef, email]);

  useEffect(() => {
    if (!restaurant?.address) return;
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(restaurant.address)}&format=json&limit=1`,
      { headers: { "Accept-Language": "en" } }
    )
      .then((r) => r.json())
      .then((data) => {
        if (data[0]) setMapCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      })
      .catch(() => {});
  }, [restaurant?.address]);

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
  const bookingIsPast = isPast(booking.date);

  const handleCancelBooking = async () => {
    if (!booking?.bookingRef) return;
    setCancelling(true);
    try {
      await cancelBookingByRef(booking.bookingRef, booking.customerEmail ?? "");
      setBooking((prev) => (prev ? { ...prev, isCancelled: true } : prev));
      setShowCancelConfirm(false);
    } catch (err) {
      showError(err);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, backgroundColor: colors.page }}
        contentContainerStyle={styles.scrollContent}
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={100}
      >
        {Platform.OS !== "web" && (
          <Stack.Screen
            options={{ title: booking.isCancelled ? "Booking Cancelled" : "Booking Confirmed" }}
          />
        )}
        <PageContainer>
          {/* Header — same spacing pattern as lookup page */}
          <View style={styles.header}>
            <View
              style={[
                styles.checkCircle,
                { backgroundColor: booking.isCancelled ? theme.colors.error : primaryColor },
              ]}
            >
              <Ionicons
                name={booking.isCancelled ? "close" : "checkmark"}
                size={32}
                color={theme.colors.white}
              />
            </View>
            <ThemedText style={styles.title}>
              {booking.isCancelled ? "Booking Cancelled" : "Booking Confirmed"}
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.muted }]}>
              {booking.customerName ? `${booking.customerName}, ` : ""}
              {booking.seats} {booking.seats === 1 ? "guest" : "guests"} at {restaurantName}
            </ThemedText>
          </View>

          {/* Booking reference — above detail rows on mobile, inside right col on wide */}
          {!isWide && (
            <View
              style={[
                styles.refCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  marginBottom: theme.spacing.lg,
                },
              ]}
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
                    style={[styles.copyBtn, { borderColor: copied ? primaryColor : colors.border }]}
                    onPress={() => {
                      navigator.clipboard.writeText(ref);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    <Ionicons
                      name={copied ? "checkmark" : "copy-outline"}
                      size={14}
                      color={copied ? primaryColor : colors.muted}
                    />
                    <ThemedText
                      style={[styles.copyBtnText, { color: copied ? primaryColor : colors.muted }]}
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
          )}

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

            {/* Right col on wide: ref card + calendar + directions stacked */}
            <View style={[isWide && styles.wideCol, styles.rightCol]}>
              {isWide && (
                <View
                  style={[
                    styles.refCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
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
                      <ThemedText style={[styles.refValue, { color: primaryColor }]}>
                        {ref}
                      </ThemedText>
                    </View>
                    {Platform.OS === "web" && (
                      <Pressable
                        style={[
                          styles.copyBtn,
                          { borderColor: copied ? primaryColor : colors.border },
                        ]}
                        onPress={() => {
                          navigator.clipboard.writeText(ref);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                      >
                        <Ionicons
                          name={copied ? "checkmark" : "copy-outline"}
                          size={14}
                          color={copied ? primaryColor : colors.muted}
                        />
                        <ThemedText
                          style={[
                            styles.copyBtnText,
                            { color: copied ? primaryColor : colors.muted },
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
              )}

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
                    endTime={booking.endTime}
                    seats={booking.seats}
                    specialRequests={booking.specialRequests}
                    restaurantName={restaurantName}
                    restaurantAddress={restaurant?.address ?? ""}
                    sectionName={booking.sectionName}
                    tableName={booking.tableName}
                    variant="full"
                  />
                </View>
              )}

              {restaurant?.address && (
                <View
                  style={[
                    styles.actionCard,
                    styles.directionsCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <ThemedText style={[styles.refLabel, { color: colors.muted }]}>
                    Get Directions
                  </ThemedText>
                  {Platform.OS === "web" &&
                    mapCoords &&
                    React.createElement("iframe", {
                      src: `https://www.openstreetmap.org/export/embed.html?bbox=${mapCoords.lng - 0.005},${mapCoords.lat - 0.005},${mapCoords.lng + 0.005},${mapCoords.lat + 0.005}&layer=mapnik&marker=${mapCoords.lat},${mapCoords.lng}`,
                      style: {
                        width: "100%",
                        height: 160,
                        border: 0,
                        borderRadius: theme.borderRadius.md,
                      },
                      loading: "lazy",
                    })}
                  <View style={styles.mapAddressRow}>
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
                  </View>
                </View>
              )}

              <View
                style={[
                  styles.actionCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Pressable
                  style={[
                    styles.cancelBtn,
                    (booking.isCancelled || bookingIsPast) && { opacity: 0.4 },
                  ]}
                  onPress={() =>
                    !booking.isCancelled && !bookingIsPast && setShowCancelConfirm(true)
                  }
                  disabled={cancelling || booking.isCancelled || bookingIsPast}
                >
                  <Ionicons name="trash-outline" size={15} color={theme.colors.error} />
                  <ThemedText style={styles.cancelBtnText}>
                    {booking.isCancelled
                      ? "Already Cancelled"
                      : bookingIsPast
                        ? "Booking Has Passed"
                        : "Cancel This Booking"}
                  </ThemedText>
                </Pressable>
              </View>

              <ThemedText style={[styles.cancelHint, { color: colors.muted }]}>
                {!booking.isCancelled && bookingIsPast
                  ? "This booking has already passed and can no longer be cancelled."
                  : "This booking cannot be modified. However, feel free to cancel and rebook if need be."}
              </ThemedText>
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

        <AlertModal
          visible={errorMessage !== null}
          title="Error"
          message={errorMessage ?? ""}
          onClose={clearError}
        />

        <Footer />
      </ScrollView>
      <ScrollToTopFab scrollY={scrollY} onPress={scrollToTop} />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 24 },
  notFoundText: { fontSize: 16, marginTop: 8 },
  retryBtn: {
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xsm,
    borderRadius: theme.borderRadius.lg,
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
  wideRow: { flexDirection: "row", gap: theme.spacing.xl, alignItems: "stretch" },
  narrowGap: { gap: theme.spacing.lg },
  wideCol: { flex: 1 },
  rightCol: { gap: theme.spacing.lg, flexDirection: "column" },

  // Detail rows card
  detailCard: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    overflow: "hidden",
    ...theme.shadows.md,
  },

  // Reference card
  refCard: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    padding: theme.spacing.lg,
    alignItems: "center",
    gap: theme.spacing.md,
    ...theme.shadows.md,
  },
  refLabel: {
    ...theme.typography.labelSmall,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  refRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xsm,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  refBadge: { ...theme.buttonSizes.secondary, borderRadius: theme.borderRadius.lg },
  refValue: { ...theme.typography.h2, fontWeight: "800" },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: theme.spacing.xsm,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
  },
  copyBtnText: { ...theme.typography.caption, fontWeight: "600" },
  refHint: { ...theme.typography.caption, textAlign: "center" },
  savedNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingTop: theme.spacing.sm,
    marginTop: theme.spacing.xsm,
    borderTopWidth: 1,
  },
  savedNoteText: { ...theme.typography.caption, opacity: 0.75 },

  // Calendar card
  actionCard: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.xsm,
    ...theme.shadows.md,
  },

  directionsCard: { gap: theme.spacing.sm },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: theme.spacing.sm,
  },
  cancelBtnText: { color: theme.colors.error, ...theme.typography.bodyBold },
  cancelHint: {
    ...theme.typography.caption,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: theme.spacing.sm,
  },
  // Directions card — same pill style as restaurant card homepage
  mapAddressRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  mapMeta: { flexDirection: "row", alignItems: "flex-start", gap: 5, flex: 1 },
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
