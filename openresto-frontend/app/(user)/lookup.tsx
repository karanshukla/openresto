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
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { scrollIntoView } from "@/utils/scrollIntoView";
import Input from "@/components/common/Input";
import { theme, ThemeColors } from "@/theme/theme";
import PageContainer from "@/components/layout/PageContainer";
import { CachedBooking, fetchCachedBookings } from "@/utils/bookingCache";
import ConfirmModal from "@/components/common/ConfirmModal";
import AlertModal from "@/components/common/AlertModal";
import CalendarActions from "@/components/booking/CalendarActions";
import BookingDetailRows from "@/components/booking/BookingDetailRows";
import { useAppTheme } from "@/hooks/use-app-theme";
import { buildCalendarUrls } from "@/utils/calendar";
import ScrollToTopFab, { SHOW_AFTER_SCROLL_Y } from "@/components/common/ScrollToTopFab";
import Footer from "@/components/layout/Footer";
import { isPast } from "@/components/admin/bookings/StatusBadge";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { MOBILE_BREAKPOINT } from "@/constants/breakpoints";
import { styles } from "@/styles/user/lookup.styles";
import { Icon } from "@/components/common/Icon";

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

  const isWide = Platform.OS === "web" && width >= MOBILE_BREAKPOINT;
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
            <Icon name="search-outline" size={32} color={primaryColor} />
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
                  accessibilityLabel="Booking reference"
                  value={refInput}
                  onChangeText={setRefInput}
                  autoCapitalize="none"
                />
                <ThemedText style={styles.label}>Email Address</ThemedText>
                <Input
                  placeholder="The email used when booking"
                  accessibilityLabel="Email address"
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
                  accessibilityRole="button"
                  accessibilityLabel="Find my booking"
                  accessibilityState={{ disabled: !canSearch || loading, busy: loading }}
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
                      <Icon name="search" size="md" color={theme.colors.white} />
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
                  role="status"
                  accessibilityLiveRegion="polite"
                  style={[
                    styles.resultCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    isWide ? { marginTop: 0 } : { marginTop: 16 },
                  ]}
                >
                  <Icon name="alert-circle-outline" size={28} color={colors.muted} />
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
                    accessibilityRole="button"
                    accessibilityLabel="Cancel this booking"
                    accessibilityState={{
                      disabled: cancelling || booking.isCancelled || bookingIsPast,
                      busy: cancelling,
                    }}
                  >
                    <Icon name="trash-outline" size={15} color={theme.colors.error} />
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

      <ScrollToTopFab visible={scrollY > SHOW_AFTER_SCROLL_Y} onPress={scrollToTop} />

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
          accessibilityRole="button"
          accessibilityLabel={`Look up booking ${c.bookingRef}${
            c.restaurantName ? ` at ${c.restaurantName}` : ""
          }`}
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
            <Icon name="chevron-forward-outline" size="md" color={colors.muted} />
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
              accessibilityRole="button"
              accessibilityLabel="Add to Google Calendar"
            >
              <Icon name="logo-google" size="lg" color={primaryColor} />
            </Pressable>
            <Pressable
              testID="cal-outlook-btn"
              style={styles.iconBtn}
              onPress={() => window.open(outlookUrl, "_blank")}
              accessibilityRole="button"
              accessibilityLabel="Add to Outlook Calendar"
            >
              <Icon name="calendar-outline" size="lg" color={primaryColor} />
            </Pressable>
            <Pressable
              testID="cal-ics-btn"
              style={styles.iconBtn}
              onPress={downloadIcs}
              accessibilityRole="button"
              accessibilityLabel="Download calendar file"
            >
              <Icon name="download-outline" size="lg" color={colors.muted} />
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
                  accessibilityRole="button"
                  accessibilityLabel="Open in Google Maps"
                  onPress={() =>
                    Linking.openURL(
                      `https://maps.google.com/?q=${encodeURIComponent(restaurant.address!)}`
                    )
                  }
                >
                  <Icon name="navigate-outline" size="lg" color={colors.muted} />
                </Pressable>
                <Pressable
                  testID="maps-apple-btn-narrow"
                  style={styles.iconBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Open in Apple Maps"
                  onPress={() =>
                    Linking.openURL(
                      `https://maps.apple.com/?q=${encodeURIComponent(restaurant.address!)}`
                    )
                  }
                >
                  <Icon name="map-outline" size="lg" color={colors.muted} />
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
                accessibilityRole="button"
                accessibilityLabel="Open in Google Maps"
              >
                <Icon name="navigate-outline" size="md" color={colors.muted} />
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
                accessibilityRole="button"
                accessibilityLabel="Open in Apple Maps"
              >
                <Icon name="navigate-outline" size="md" color={colors.muted} />
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
          <Icon
            name={booking.isCancelled ? "close-circle" : "checkmark-circle"}
            size="xl"
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
              accessibilityRole="button"
              accessibilityLabel={copied ? "Booking reference copied" : "Copy booking reference"}
            >
              <Icon
                name={copied ? "checkmark" : "copy-outline"}
                size="sm"
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
