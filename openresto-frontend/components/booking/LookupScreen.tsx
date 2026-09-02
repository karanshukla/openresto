import { useEffect, useRef, useState } from "react";
import { Linking, Platform, ScrollView, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import ButtonRow from "@/components/common/ButtonRow";
import { Icon } from "@/components/common/Icon";
import PageContainer from "@/components/layout/PageContainer";
import Footer from "@/components/layout/Footer";
import { useScrollToTopFab } from "@/hooks/use-scroll-to-top-fab";
import ScrollToTopFab from "@/components/common/ScrollToTopFab";
import ConfirmModal from "@/components/common/ConfirmModal";
import AlertModal from "@/components/common/AlertModal";
import SlidePanel from "@/components/common/SlidePanel";
import BookingConfirmationSkeleton from "@/components/booking/BookingConfirmationSkeleton";
import { KeyboardAvoider } from "@/components/common/KeyboardAvoider";
import BookingResultPanel from "@/components/booking/BookingResultPanel";
import RecentBookingsList from "@/components/booking/RecentBookingsList";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { isMobileWidth } from "@/constants/breakpoints";
import { registerFocusTarget, unregisterFocusTarget } from "@/utils/focusRegistry";
import { CachedBooking, fetchCachedBookings } from "@/utils/bookingCache";
import { hasContact, mailtoHref, resolveContact, telHref } from "@/utils/contact";
import { useBrand } from "@/context/BrandContext";
import { useBookingLookup } from "@/hooks/useBookingLookup";
import { useOnline } from "@/hooks/use-online";
import ScreenHeading from "@/components/layout/ScreenHeading";
import { styles } from "@/styles/user/lookup.styles";

/**
 * The find-my-booking screen: a search form, plus — once a lookup runs — a result panel
 * that slides in beside it (a bottom sheet on compact widths), the way BookingDrawer opens
 * beside the locations list. Booking confirmation is a state of this screen rather than a
 * screen of its own: /booking-confirmation/[bookingRef] mounts it with `justBooked` and the
 * ref/email prefilled instead of rendering an independent page. `justBooked` reaches only the
 * result panel's own wording and the arrival haptic — the page around it is the same page on
 * both routes, on web and off it, which is the point of there being one screen.
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
  const { t } = useTranslation();
  const [refInput, setRefInput] = useState(initialRef ?? "");
  const [emailInput, setEmailInput] = useState(initialEmail ?? "");
  const [cached, setCached] = useState<CachedBooking[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const fab = useScrollToTopFab();
  const refInputRef = useRef<TextInput>(null);
  const didDeepLink = useRef(false);
  const hasTyped = useRef(false);

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
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const brand = useBrand();
  const contact = resolveContact(restaurant, brand);
  const isCompact = isMobileWidth(width);
  const canSearch = Boolean(refInput.trim() && emailInput.trim());
  const showPanel = status !== "idle";
  const twoColumn = !isCompact && showPanel;

  // Read once, at mount, because the auto-open below fires once: a diner who rotates their
  // phone mid-session shouldn't have a booking opened at them for it.
  const wideOnArrival = useRef(!isCompact);

  useEffect(() => {
    registerFocusTarget("user-lookup", refInputRef);
    return () => unregisterFocusTarget("user-lookup");
  }, []);

  useEffect(() => {
    fetchCachedBookings().then((list) => {
      setCached(list);
      // A returning diner almost always wants the booking they just made, so the page
      // opens on it rather than on an empty panel beside a form they'd have to fill from
      // a reference they don't have to hand. Three things it must not trample. A ref in
      // the URL: /booking-confirmation and a shared /lookup link name their own booking,
      // and the effect below is already fetching it. Anything already typed: the cookie
      // read is async, so someone who beats it to the keyboard would lose what they
      // entered. And a compact width, where the result is a sheet over the whole viewport
      // rather than a column beside the form — opening one on arrival would bury the
      // search this page exists for behind something to dismiss.
      if (initialRef || !wideOnArrival.current || hasTyped.current || list.length === 0) return;
      setRefInput(list[0].bookingRef);
      setEmailInput(list[0].email);
      lookup(list[0].bookingRef, list[0].email);
    });
  }, [initialRef, lookup]);

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

  const handleTypedChange = (setter: (value: string) => void) => (value: string) => {
    hasTyped.current = true;
    setter(value);
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
            {t("lookup.notFound")}
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
            {/* A lookup that failed with no connection is not the booking system being
                unreachable — the diner's own device is, and the recent bookings held on it
                are still on screen underneath. */}
            {online ? t("lookup.connectionError") : t("lookup.offlineError")}
          </ThemedText>
        </View>
        <Button variant="ghost" tone="neutral" size="sm" onPress={handleLookup}>
          {t("common.actions.tryAgain")}
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
    <ThemedView
      // Neither of this screen's two routes draws a native header off web, so both take the
      // status-bar inset themselves and both carry their own title.
      style={[styles.root, Platform.OS !== "web" && { paddingTop: insets.top }]}
    >
      <KeyboardAvoider style={styles.root}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          onScroll={fab.trackScroll}
          scrollEventThrottle={16}
        >
          <PageContainer style={[styles.page, twoColumn ? styles.pageWide : styles.pageIdle]}>
            <ScreenHeading
              standalone
              title={t("lookup.title")}
              subtitle={t("lookup.subtitle")}
              style={styles.header}
            />

            <View style={twoColumn ? styles.wideRow : styles.singleCol}>
              <View style={twoColumn ? styles.formCol : undefined}>
                <View
                  style={[
                    styles.searchCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <ThemedText style={styles.label}>{t("lookup.form.referenceLabel")}</ThemedText>
                  <Input
                    ref={refInputRef}
                    placeholder={t("lookup.form.referencePlaceholder")}
                    accessibilityLabel={t("lookup.form.referenceA11y")}
                    value={refInput}
                    onChangeText={handleTypedChange(setRefInput)}
                    autoCapitalize="none"
                  />
                  <ThemedText style={styles.label}>{t("lookup.form.emailLabel")}</ThemedText>
                  <Input
                    placeholder={t("lookup.form.emailPlaceholder")}
                    accessibilityLabel={t("lookup.form.emailA11y")}
                    value={emailInput}
                    onChangeText={handleTypedChange(setEmailInput)}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    autoComplete="email"
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
                    accessibilityLabel={t("lookup.form.submitA11y")}
                  >
                    {t("lookup.form.submitButton")}
                  </Button>
                  <ThemedText style={[styles.helpText, { color: colors.muted }]}>
                    {t("lookup.form.helpText")}
                  </ThemedText>
                  {/* Telling someone to get in touch without saying how is half an
                    instruction. Falls back to the brand's details until a lookup names a
                    location, which is the same per-field resolution the rest of the app
                    uses, so a location listing only a phone still shows the global email. */}
                  {hasContact(contact) && (
                    <ButtonRow align="center" style={styles.contactRow}>
                      {contact.phone && (
                        <Button
                          variant="ghost"
                          tone="brand"
                          size="sm"
                          icon="call-outline"
                          onPress={() => Linking.openURL(telHref(contact.phone!))}
                          accessibilityLabel={t("lookup.form.callLabel", { phone: contact.phone })}
                        >
                          {contact.phone}
                        </Button>
                      )}
                      {contact.email && (
                        <Button
                          variant="ghost"
                          tone="brand"
                          size="sm"
                          icon="mail-outline"
                          onPress={() => Linking.openURL(mailtoHref(contact.email!))}
                          accessibilityLabel={t("lookup.form.emailContactLabel", {
                            email: contact.email,
                          })}
                        >
                          {contact.email}
                        </Button>
                      )}
                    </ButtonRow>
                  )}
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
                  <SlidePanel
                    variant="side"
                    onDismiss={reset}
                    accessibilityLabel={t("lookup.resultPanelA11y")}
                  >
                    {panelContent}
                  </SlidePanel>
                </View>
              )}
            </View>
          </PageContainer>

          <ScrollToTopFab visible={fab.visible} onPress={scrollToTop} />
          <Footer />
        </ScrollView>
      </KeyboardAvoider>

      {isCompact && showPanel && (
        <SlidePanel
          variant="sheet"
          onDismiss={reset}
          accessibilityLabel={t("lookup.resultPanelA11y")}
        >
          {panelContent}
        </SlidePanel>
      )}

      {showCancelConfirm && (
        <ConfirmModal
          visible={showCancelConfirm}
          title={t("lookup.cancelModal.title")}
          message={t("lookup.cancelModal.message")}
          confirmLabel={
            cancelling ? t("lookup.cancelModal.confirming") : t("lookup.cancelModal.confirm")
          }
          cancelLabel={t("lookup.cancelModal.keep")}
          destructive
          onConfirm={cancelBooking}
          onCancel={() => !cancelling && setShowCancelConfirm(false)}
        />
      )}

      {errorMessage !== null && (
        <AlertModal
          visible={errorMessage !== null}
          title={t("errors.title")}
          message={errorMessage}
          onClose={clearError}
        />
      )}
    </ThemedView>
  );
}
