import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { getBookingByRef, BookingDto, cancelBookingByRef } from "@/api/bookings";
import { fetchRestaurantById, RestaurantDto } from "@/api/restaurants";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  findNodeHandle,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Input from "@/components/common/Input";
import {
  BUTTON_SIZES,
  BORDER_RADIUS,
  COLORS,
  SHADOWS,
  SPACING,
  TYPOGRAPHY,
  ThemeColors,
} from "@/theme/theme";
import { Ionicons } from "@expo/vector-icons";
import PageContainer from "@/components/layout/PageContainer";
import { CachedBooking, fetchCachedBookings } from "@/utils/bookingCache";
import ConfirmModal from "@/components/common/ConfirmModal";
import CalendarActions from "@/components/booking/CalendarActions";
import BookingDetailRows from "@/components/booking/BookingDetailRows";
import { useAppTheme } from "@/hooks/use-app-theme";
import { buildCalendarUrls } from "@/utils/calendar";
import ScrollToTopFab from "@/components/common/ScrollToTopFab";

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
  const [scrollY, setScrollY] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const bookingCardRef = useRef<View>(null);
  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  useEffect(() => {
    if (loading || !booking) return;
    const timer = setTimeout(() => {
      if (!bookingCardRef.current) return;
      if (Platform.OS === "web") {
        (bookingCardRef.current as any).scrollIntoView?.({ behavior: "smooth", block: "start" });
      } else {
        const node = findNodeHandle(scrollRef.current);
        if (!node) return;
        bookingCardRef.current.measureLayout(
          node,
          (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true }),
          () => {},
        );
      }
    }, 150);
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
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="search" size={16} color={COLORS.white} />
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
                      booking.isCancelled && { opacity: 0.4 },
                    ]}
                    onPress={() => !booking.isCancelled && setShowCancelConfirm(true)}
                    disabled={cancelling || booking.isCancelled}
                  >
                    <Ionicons name="trash-outline" size={15} color={COLORS.error} />
                    <ThemedText style={styles.cancelBtnText}>
                      {booking.isCancelled ? "Already Cancelled" : "Cancel This Booking"}
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
            <Pressable style={styles.iconBtn} onPress={() => window.open(googleUrl, "_blank")}>
              <Ionicons name="logo-google" size={18} color={primaryColor} />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={() => window.open(outlookUrl, "_blank")}>
              <Ionicons name="calendar-outline" size={18} color={primaryColor} />
            </Pressable>
            <Pressable style={styles.iconBtn} onPress={downloadIcs}>
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
          seats={booking.seats}
          specialRequests={booking.specialRequests}
          restaurantName={restaurant?.name ?? "Restaurant"}
          restaurantAddress={restaurant?.address ?? ""}
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
            color={booking.isCancelled ? COLORS.error : primaryColor}
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
  scrollContent: { paddingBottom: 60 },
  header: { alignItems: "center", gap: 8, marginTop: 8, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.6, marginTop: 8 },
  subtitle: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  wideRow: { flexDirection: "row", gap: 24, alignItems: "flex-start" },
  wideCol: { flex: 1 },
  searchCard: {
    borderRadius: BORDER_RADIUS.card,
    borderWidth: 1,
    padding: SPACING.xl,
    gap: SPACING.md,
    width: "100%",
    ...SHADOWS.md,
  },
  label: { ...TYPOGRAPHY.label, letterSpacing: 0.2 },
  searchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    ...BUTTON_SIZES.primary,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: 4,
  },
  searchBtnText: { color: COLORS.white, ...TYPOGRAPHY.bodyBold, fontWeight: "700" },
  helpText: { ...TYPOGRAPHY.caption, textAlign: "center", lineHeight: 18, marginTop: 4 },
  resultCard: {
    borderRadius: BORDER_RADIUS.card,
    borderWidth: 1,
    padding: SPACING.xxl,
    marginTop: SPACING.xl,
    width: "100%",
    alignItems: "center",
    gap: SPACING.lg,
    ...SHADOWS.md,
  },
  notFound: { ...TYPOGRAPHY.body, textAlign: "center" },
  detailCard: {
    borderRadius: BORDER_RADIUS.card,
    borderWidth: 1,
    overflow: "hidden",
    ...SHADOWS.md,
  },
  cardHeader: {
    alignItems: "center",
    gap: SPACING.xsm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  resultHeader: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  resultTitle: { ...TYPOGRAPHY.h3 },
  refBadge: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  refText: { ...TYPOGRAPHY.bodyBold, fontWeight: "700", letterSpacing: 0.3 },
  divider: { height: 1 },
  refBadgeRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
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
  iconStrip: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BORDER_RADIUS.card,
    borderWidth: 1,
    marginTop: 10,
    paddingVertical: SPACING.xsm,
    ...SHADOWS.md,
  },
  iconGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
  },
  iconGroupLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, marginRight: 2 },
  iconGroupRow: { flexDirection: "row" },
  iconBtn: { padding: SPACING.xsm, borderRadius: BORDER_RADIUS.md },
  iconSep: { width: 1, alignSelf: "stretch" },
  actionsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  actionCard: {
    flex: 1,
    borderRadius: BORDER_RADIUS.card,
    borderWidth: 1,
    overflow: "hidden",
    ...SHADOWS.md,
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
    borderRadius: BORDER_RADIUS.card,
    borderWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    ...SHADOWS.md,
  },
  cancelBtnText: { color: COLORS.error, ...TYPOGRAPHY.bodyBold },
  recentSection: { marginTop: SPACING.xl, gap: SPACING.xsm, width: "100%" },
  recentTitle: { ...TYPOGRAPHY.labelSmall, fontWeight: "700", letterSpacing: 0.8, marginBottom: 2 },
  recentCard: {
    borderRadius: BORDER_RADIUS.card,
    borderWidth: 1,
    padding: 14,
    ...SHADOWS.md,
  },
  recentCardRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  recentRef: { fontSize: 14, fontWeight: "700", letterSpacing: -0.2, flex: 1 },
  recentMeta: { ...TYPOGRAPHY.caption },
});
