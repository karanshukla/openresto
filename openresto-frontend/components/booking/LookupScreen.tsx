import { useEffect, useRef, useState } from "react";
import { ScrollView, TextInput, useWindowDimensions, View } from "react-native";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { Icon } from "@/components/common/Icon";
import PageContainer from "@/components/layout/PageContainer";
import Footer from "@/components/layout/Footer";
import ScrollToTopFab, { SHOW_AFTER_SCROLL_Y } from "@/components/common/ScrollToTopFab";
import ConfirmModal from "@/components/common/ConfirmModal";
import AlertModal from "@/components/common/AlertModal";
import SlidePanel from "@/components/common/SlidePanel";
import BookingConfirmationSkeleton from "@/components/booking/BookingConfirmationSkeleton";
import BookingResultPanel from "@/components/booking/BookingResultPanel";
import RecentBookingsList from "@/components/booking/RecentBookingsList";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { isMobileWidth } from "@/constants/breakpoints";
import { registerFocusTarget, unregisterFocusTarget } from "@/utils/focusRegistry";
import { CachedBooking, fetchCachedBookings } from "@/utils/bookingCache";
import { useBookingLookup } from "@/hooks/useBookingLookup";
import { styles } from "@/styles/user/lookup.styles";

/**
 * The find-my-booking screen: a search form, plus — once a lookup runs — a result panel
 * that slides in beside it (a bottom sheet on compact widths), the way BookingDrawer opens
 * beside the locations list. Booking confirmation is a state of this screen rather than a
 * screen of its own: /booking-confirmation/[bookingRef] mounts it with `justBooked` and the
 * ref/email prefilled instead of rendering an independent page.
 */
export default function LookupScreen({
  initialRef,
  initialEmail,
  legacyBookingId,
  justBooked = false,
}: {
  initialRef?: string;
  initialEmail?: string;
  /** /booking-confirmation/<numeric id> predates booking references; tried only if the
   * ref+email lookup itself comes back not-found. */
  legacyBookingId?: number;
  justBooked?: boolean;
}) {
  const [refInput, setRefInput] = useState(initialRef ?? "");
  const [emailInput, setEmailInput] = useState(initialEmail ?? "");
  const [cached, setCached] = useState<CachedBooking[]>([]);
  const [scrollY, setScrollY] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const refInputRef = useRef<TextInput>(null);
  const didDeepLink = useRef(false);

  const {
    booking,
    restaurant,
    status,
    lookup,
    reset,
    showCancelConfirm,
    setShowCancelConfirm,
    cancelling,
    cancelBooking,
    errorMessage,
    clearError,
  } = useBookingLookup();

  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  const isCompact = isMobileWidth(width);
  const canSearch = Boolean(refInput.trim() && emailInput.trim());
  const showPanel = status !== "idle";
  const twoColumn = !isCompact && showPanel;

  useEffect(() => {
    registerFocusTarget("user-lookup", refInputRef);
    return () => unregisterFocusTarget("user-lookup");
  }, []);

  useEffect(() => {
    fetchCachedBookings().then(setCached);
  }, []);

  useEffect(() => {
    if (didDeepLink.current || !initialRef) return;
    // A plain /lookup?ref=&email= deep link needs both to satisfy the backend's email
    // gate. /booking-confirmation entries proceed even without one — a legacy numeric
    // link may never have carried an email at all — and land on a real not-found/error
    // state instead of just sitting idle.
    if (!justBooked && !initialEmail) return;
    didDeepLink.current = true;
    lookup(
      initialRef,
      initialEmail ?? "",
      legacyBookingId !== undefined ? { legacyId: legacyBookingId } : undefined
    ).then((outcome) => {
      if (justBooked && outcome.status === "found") {
        Haptics.notificationAsync(
          outcome.booking.isCancelled
            ? Haptics.NotificationFeedbackType.Error
            : Haptics.NotificationFeedbackType.Success
        );
      }
    });
  }, [initialRef, initialEmail, legacyBookingId, justBooked, lookup]);

  const scrollToTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true });

  const handleLookup = () => {
    const ref = refInput.trim();
    const email = emailInput.trim();
    if (!ref || !email) return;
    lookup(ref, email);
  };

  const handleRecentSelect = (c: CachedBooking) => {
    setRefInput(c.bookingRef);
    setEmailInput(c.email);
    lookup(c.bookingRef, c.email);
  };

  let panelContent: React.ReactNode = null;
  if (status === "loading") {
    panelContent = <BookingConfirmationSkeleton inline />;
  } else if (status === "notFound") {
    panelContent = (
      <View
        role="status"
        accessibilityLiveRegion="polite"
        style={[styles.msgCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.msgRow}>
          <Icon name="alert-circle-outline" size="md" color={colors.muted} />
          <ThemedText style={[styles.msgText, { color: colors.muted }]}>
            No booking found matching that reference and email.
          </ThemedText>
        </View>
      </View>
    );
  } else if (status === "error") {
    panelContent = (
      <View
        role="alert"
        accessibilityLiveRegion="assertive"
        style={[styles.msgCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={styles.msgRow}>
          <Icon name="cloud-offline-outline" size="md" color={theme.colors.error} />
          <ThemedText style={[styles.msgText, { color: colors.muted }]}>
            We couldn&apos;t reach the booking system. Your booking is safe.
          </ThemedText>
        </View>
        <Button variant="ghost" tone="neutral" size="sm" onPress={handleLookup}>
          Try again
        </Button>
      </View>
    );
  } else if (status === "found" && booking) {
    panelContent = (
      <View role="status" accessibilityLiveRegion="polite">
        <BookingResultPanel
          booking={booking}
          restaurant={restaurant}
          compact={isCompact}
          justBooked={justBooked}
          cancelling={cancelling}
          onCancelPress={() => setShowCancelConfirm(true)}
        />
      </View>
    );
  }

  return (
    <ThemedView style={styles.root}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={100}
      >
        <PageContainer style={[styles.page, twoColumn ? styles.pageWide : styles.pageIdle]}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Find my booking</ThemedText>
            <ThemedText style={[styles.subtitle, { color: colors.muted }]}>
              Enter your booking reference and email to look up your reservation.
            </ThemedText>
          </View>

          <View style={twoColumn ? styles.wideRow : styles.singleCol}>
            <View style={twoColumn ? styles.formCol : undefined}>
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
                <Button
                  size="lg"
                  fullWidth
                  icon="search"
                  disabled={!canSearch}
                  loading={status === "loading"}
                  onPress={handleLookup}
                  accessibilityLabel="Find my booking"
                >
                  Look Up
                </Button>
                <ThemedText style={[styles.helpText, { color: colors.muted }]}>
                  Can&apos;t find your booking? Contact the restaurant directly.
                </ThemedText>
              </View>

              {/* Stays put while a result is showing — the panel is a column over, not on
                  top of this list, so the diner can switch between their bookings without
                  dismissing anything. The one on screen is marked rather than removed, so
                  the list doesn't reshuffle under the press that opened it. */}
              <RecentBookingsList
                cached={cached}
                colors={colors}
                activeRef={status === "found" ? (booking?.bookingRef ?? null) : null}
                onSelect={handleRecentSelect}
              />
            </View>

            {twoColumn && (
              <View style={styles.resultCol}>
                <SlidePanel variant="side" onDismiss={reset} accessibilityLabel="Booking result">
                  {panelContent}
                </SlidePanel>
              </View>
            )}
          </View>
        </PageContainer>

        <Footer />
      </ScrollView>

      {isCompact && showPanel && (
        <SlidePanel variant="sheet" onDismiss={reset} accessibilityLabel="Booking result">
          {panelContent}
        </SlidePanel>
      )}

      <ScrollToTopFab visible={scrollY > SHOW_AFTER_SCROLL_Y} onPress={scrollToTop} />

      <ConfirmModal
        visible={showCancelConfirm}
        title="Cancel Reservation"
        message="Are you sure you want to cancel this booking? This action cannot be undone."
        confirmLabel={cancelling ? "Cancelling..." : "Cancel Booking"}
        cancelLabel="Keep Booking"
        destructive
        onConfirm={cancelBooking}
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
