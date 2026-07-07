import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { getBookingByRef, BookingDto, cancelBookingByRef } from "@/api/bookings";
import { fetchRestaurantById, RestaurantDto } from "@/api/restaurants";
import { useEffect, useState, useRef, useCallback } from "react";
import { registerFocusTarget, unregisterFocusTarget } from "@/utils/focusRegistry";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { scrollIntoView } from "@/utils/scrollIntoView";
import Input from "@/components/common/Input";
import { theme, ThemeColors } from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import PageContainer from "@/components/layout/PageContainer";
import { CachedBooking, fetchCachedBookings } from "@/utils/bookingCache";
import ConfirmModal from "@/components/common/ConfirmModal";
import AlertModal from "@/components/common/AlertModal";
import CalendarActions from "@/components/booking/CalendarActions";
import BookingDetailRows from "@/components/booking/BookingDetailRows";
import { useAppTheme } from "@/hooks/use-app-theme";
import { buildCalendarUrls } from "@/utils/calendar";
import ScrollToTopFab from "@/components/common/ScrollToTopFab";
import Footer from "@/components/layout/Footer";
import { isPast } from "@/components/admin/bookings/StatusBadge";
import { useErrorHandler } from "@/hooks/useErrorHandler";

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
  const { errorMessage, showError, clearError } = useErrorHandler();
  const [scrollY, setScrollY] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const bookingCardRef = useRef<View>(null);
  const refInputRef = useRef<TextInput>(null);
  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  useEffect(() => {
    registerFocusTarget("user-lookup", refInputRef);
    return () => unregisterFocusTarget("user-lookup");
  }, []);

  useEffect(() => {
    if (loading || !booking) return;
    const timer = setTimeout(() => scrollIntoView(bookingCardRef, scrollRef, "start"), 150);
    return () => clearTimeout(timer);
  }, [loading, booking]);

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
      await cancelBookingByRef(booking.bookingRef, booking.customerEmail);
      await performLookup(booking.bookingRef, booking.customerEmail);
      setShowCancelConfirm(false);
    } catch (err) {
      showError(err);
    } finally {
      setCancelling(false);
    }
  };

  const bookingIsPast = booking ? isPast(booking.date) : false;

  return (
    <ThemedView style={styles.root}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={100}
      >
        <PageContainer>
          <View style={[styles.header, !isWide && { marginBottom: 12 }]}>
            <Ionicons name="search-outline" size={32} color={primaryColor} />
            <ThemedText style={styles.title}>Find My Booking</ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.muted }]}>
              Enter your booking reference and email to look up your reservation.
            </ThemedText>
          </View>

          <View style={isWide ? styles.wideRow : undefined}>
            <View style={isWide ? styles.wideCol : undefined}>
              <View
                style={[
                  styles.searchCard,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <ThemedText style={styles.label}>Booking Reference</ThemedText>
                <Input
                  ref={refInputRef}
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
                  style={[
                    styles.searchBtn,
                    { backgroundColor: primaryColor },
                    (!canSearch || loading) && { opacity: 0.5 },
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color={theme.colors.white} />
                  ) : (
                    <>
                      <Ionicons name="search" size={16} color={theme.colors.white} />
                      <ThemedText style={styles.searchBtnText}>Look Up</ThemedText>
                    </>
                  )}
                </Pressable>
                <ThemedText style={[styles.helpText, { color: colors.muted }]}>
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
                  style={[
                    styles.resultCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
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
                <View ref={bookingCardRef}>
                  <BookingResultCard
                    booking={booking}
                    restaurant={restaurant}
                    primaryColor={primaryColor}
                    colors={colors}
                    isDark={isDark}
                    isWide={isWide}
                  />

                  <BookingActions
                    booking={booking}
                    restaurant={restaurant}
                    colors={colors}
                    isDark={isDark}
                    isWide={isWide}
                    primaryColor={primaryColor}
                  />

                  <Pressable
                    style={[
                      styles.cancelSection,
                      { borderColor: colors.border, backgroundColor: colors.card },
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

        <Footer />
      </ScrollView>

      <ScrollToTopFab scrollY={scrollY} onPress={scrollToTop} />

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
    </ThemedView>
  );
}

function RecentBookingsList({
  cached,
  colors,
  style,
  onSelect,
}: {
  cached: CachedBooking[];
  colors: ThemeColors;
  style?: StyleProp<ViewStyle>;
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
          style={[styles.recentCard, { backgroundColor: colors.card, borderColor: colors.border }]}
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

function BookingActions({
  booking,
  restaurant,
  colors,
  isDark,
  isWide,
  primaryColor,
}: {
  booking: BookingDto;
  restaurant: RestaurantDto | null;
  colors: ThemeColors;
  isDark: boolean;
  isWide: boolean;
  primaryColor: string;
}) {
  if (!booking.bookingRef || Platform.OS !== "web") return null;

  const { googleUrl, outlookUrl, downloadIcs } = buildCalendarUrls({
    bookingRef: booking.bookingRef,
    date: booking.date,
    seats: booking.seats,
    specialRequests: booking.specialRequests,
    restaurantName: restaurant?.name ?? "Restaurant",
    restaurantAddress: restaurant?.address ?? "",
  });

  if (!isWide) {
    return (
      <View
        style={[styles.iconStrip, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.iconGroup}>
          <ThemedText style={[styles.iconGroupLabel, { color: colors.muted }]}>CAL</ThemedText>
          <View style={styles.iconGroupRow}>
            <Pressable
              testID="cal-google-btn"
              style={styles.iconBtn}
              onPress={() => window.open(googleUrl, "_blank")}
            >
              <Ionicons name="logo-google" size={18} color={primaryColor} />
            </Pressable>
            <Pressable
              testID="cal-outlook-btn"
              style={styles.iconBtn}
              onPress={() => window.open(outlookUrl, "_blank")}
            >
              <Ionicons name="calendar-outline" size={18} color={primaryColor} />
            </Pressable>
            <Pressable testID="cal-ics-btn" style={styles.iconBtn} onPress={downloadIcs}>
              <Ionicons name="download-outline" size={18} color={colors.muted} />
            </Pressable>
          </View>
        </View>
        {restaurant?.address && (
          <>
            <View style={[styles.iconSep, { backgroundColor: colors.border }]} />
            <View style={styles.iconGroup}>
              <ThemedText style={[styles.iconGroupLabel, { color: colors.muted }]}>MAPS</ThemedText>
              <View style={styles.iconGroupRow}>
                <Pressable
                  testID="maps-google-btn-narrow"
                  style={styles.iconBtn}
                  onPress={() =>
                    Linking.openURL(
                      `https://maps.google.com/?q=${encodeURIComponent(restaurant.address!)}`
                    )
                  }
                >
                  <Ionicons name="navigate-outline" size={18} color={colors.muted} />
                </Pressable>
                <Pressable
                  testID="maps-apple-btn-narrow"
                  style={styles.iconBtn}
                  onPress={() =>
                    Linking.openURL(
                      `https://maps.apple.com/?q=${encodeURIComponent(restaurant.address!)}`
                    )
                  }
                >
                  <Ionicons name="map-outline" size={18} color={colors.muted} />
                </Pressable>
              </View>
            </View>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.actionsRow}>
      <View
        style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <CalendarActions
          bookingRef={booking.bookingRef}
          date={booking.date}
          endTime={booking.endTime}
          seats={booking.seats}
          specialRequests={booking.specialRequests}
          restaurantName={restaurant?.name ?? "Restaurant"}
          restaurantAddress={restaurant?.address ?? ""}
          sectionName={booking.sectionName}
          tableName={booking.tableName}
          variant="compact"
        />
      </View>
      {restaurant?.address && (
        <View
          style={[styles.actionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <View
            style={[
              styles.mapsWrap,
              { backgroundColor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" },
            ]}
          >
            <ThemedText style={[styles.mapsTitle, { color: colors.muted }]}>
              GET DIRECTIONS
            </ThemedText>
            <View style={styles.mapBtnsRow}>
              <Pressable
                style={[
                  styles.mapBtn,
                  { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
                ]}
                onPress={() =>
                  Linking.openURL(
                    `https://maps.google.com/?q=${encodeURIComponent(restaurant.address!)}`
                  )
                }
              >
                <Ionicons name="navigate-outline" size={16} color={colors.muted} />
                <ThemedText style={[styles.mapBtnText, { color: colors.muted }]}>Google</ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.mapBtn,
                  { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
                ]}
                onPress={() =>
                  Linking.openURL(
                    `https://maps.apple.com/?q=${encodeURIComponent(restaurant.address!)}`
                  )
                }
              >
                <Ionicons name="navigate-outline" size={16} color={colors.muted} />
                <ThemedText style={[styles.mapBtnText, { color: colors.muted }]}>Apple</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      )}
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
}: {
  booking: BookingDto;
  restaurant: RestaurantDto | null;
  primaryColor: string;
  colors: ThemeColors;
  isDark: boolean;
  isWide: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (Platform.OS === "web" && navigator.clipboard && booking.bookingRef) {
      navigator.clipboard.writeText(booking.bookingRef);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View
      style={[
        styles.detailCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        isWide ? {} : { marginTop: 24 },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.resultHeader}>
          <Ionicons
            name={booking.isCancelled ? "close-circle" : "checkmark-circle"}
            size={20}
            color={booking.isCancelled ? theme.colors.error : primaryColor}
          />
          <ThemedText style={styles.resultTitle}>
            {booking.isCancelled ? "Booking Cancelled" : "Booking Found"}
          </ThemedText>
        </View>
        <View style={styles.refBadgeRow}>
          <View
            style={[
              styles.refBadge,
              { backgroundColor: isDark ? `${primaryColor}22` : `${primaryColor}14` },
            ]}
          >
            <ThemedText style={[styles.refText, { color: primaryColor }]}>
              {booking.bookingRef}
            </ThemedText>
          </View>
          {Platform.OS === "web" && (
            <Pressable
              style={[styles.copyBtn, { borderColor: copied ? primaryColor : colors.border }]}
              onPress={handleCopy}
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
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <BookingDetailRows
        booking={booking}
        restaurant={restaurant}
        mutedColor={colors.muted}
        borderColor={colors.border}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  header: { alignItems: "center", gap: 8, marginTop: 8, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.6, marginTop: 8 },
  subtitle: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  wideRow: { flexDirection: "row", gap: 24, alignItems: "flex-start" },
  wideCol: { flex: 1 },
  searchCard: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    width: "100%",
    ...theme.shadows.md,
  },
  label: { ...theme.typography.label, letterSpacing: 0.2 },
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    ...theme.buttonSizes.primary,
    borderRadius: theme.borderRadius.lg,
    marginTop: 4,
  },
  searchBtnText: { color: theme.colors.white, ...theme.typography.bodyBold, fontWeight: "700" },
  helpText: { ...theme.typography.caption, textAlign: "center", lineHeight: 18, marginTop: 4 },
  resultCard: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    padding: theme.spacing.xxl,
    marginTop: theme.spacing.xl,
    width: "100%",
    alignItems: "center",
    gap: theme.spacing.lg,
    ...theme.shadows.md,
  },
  notFound: { ...theme.typography.body, textAlign: "center" },
  detailCard: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    overflow: "hidden",
    ...theme.shadows.md,
  },
  cardHeader: {
    alignItems: "center",
    gap: theme.spacing.xsm,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.lg,
  },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  resultTitle: { ...theme.typography.h3 },
  refBadge: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  refText: { ...theme.typography.bodyBold, fontWeight: "700", letterSpacing: 0.3 },
  divider: { height: 1 },
  refBadgeRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
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
  iconStrip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: theme.spacing.xsm,
    ...theme.shadows.md,
  },
  iconGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
  },
  iconGroupLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, marginRight: 2 },
  iconGroupRow: { flexDirection: "row" },
  iconBtn: { padding: theme.spacing.xsm, borderRadius: theme.borderRadius.md },
  iconSep: { width: 1, alignSelf: "stretch" },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  actionCard: {
    flex: 1,
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    overflow: "hidden",
    ...theme.shadows.md,
  },
  mapsWrap: { padding: 16, gap: 10, flex: 1 },
  mapsTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  mapBtnsRow: { flexDirection: "row", gap: 8 },
  mapBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
  },
  mapBtnText: { fontSize: 12, fontWeight: "600" },
  cancelSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10,
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 14,
    ...theme.shadows.md,
  },
  cancelBtnText: { color: theme.colors.error, ...theme.typography.bodyBold },
  recentSection: { marginTop: theme.spacing.xl, gap: theme.spacing.xsm, width: "100%" },
  recentTitle: {
    ...theme.typography.labelSmall,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  recentCard: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    padding: 14,
    ...theme.shadows.md,
  },
  recentCardRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  recentRef: { fontSize: 14, fontWeight: "700", letterSpacing: -0.2, flex: 1 },
  recentMeta: { ...theme.typography.caption },
});
