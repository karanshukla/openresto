import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  GestureResponderHandlers,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAppTheme } from "@/hooks/use-app-theme";
import { theme } from "@/theme/theme";
import { RestaurantDto } from "@/api/restaurants";
import { createBooking } from "@/api/bookings";
import { rememberBooking } from "@/utils/bookingCache";
import { convertLocalToUtc } from "@/utils/date";
import { fmtDateString } from "@/utils/formatters";
import BookingForm, { BookingFormData } from "@/components/booking/BookingForm";
import { KeyboardAvoider } from "@/components/common/KeyboardAvoider";
import Select from "@/components/common/Select";
import { animateNode, EASE_ENTER, EASE_EXIT, prefersReducedMotion } from "@/utils/webAnimation";
import {
  SHEET_EXIT_DISTANCE,
  SIDE_ENTER_DISTANCE,
  SIDE_ENTER_MS,
  SIDE_EXIT_MS,
  shouldDismissSheet,
} from "@/utils/panelMotion";
import { styles } from "./BookingDrawer.styles";
import { Icon } from "@/components/common/Icon";

// Re-exported so existing imports of these from BookingDrawer (this module used to define
// them) keep working; utils/panelMotion is the source of truth, shared with SlidePanel.
export { shouldDismissSheet };

function summaryLine(
  t: TFunction,
  seats: number,
  date: string,
  time: string,
  today: string
): string {
  const when = date === today ? t("booking.drawer.today") : fmtDateString(date);
  return t("booking.drawer.summaryLine", { count: seats, when, time });
}

/**
 * Booking surface for the Locations list: a side panel on desktop, a bottom sheet on phones.
 */
export default function BookingDrawer({
  restaurant,
  restaurants,
  onRestaurantChange,
  seats,
  onSeatsChange,
  date,
  onDateChange,
  time,
  today,
  variant,
  onClose,
}: {
  restaurant: RestaurantDto;
  /**
   * Every location the page is showing. More than one turns the panel's title into a picker,
   * so a diner who opened the wrong branch — or wants to compare two — switches in place
   * instead of closing the panel and hunting down the other card.
   */
  restaurants?: RestaurantDto[];
  onRestaurantChange?: (restaurant: RestaurantDto) => void;
  seats: number;
  /** Party size and date are the page's, so changing either in here re-filters the list. */
  onSeatsChange: (seats: number) => void;
  date: string;
  onDateChange: (date: string) => void;
  time: string;
  /** Today's date in the brand's timezone, for the "Today · 19:30" summary. */
  today: string;
  variant: "side" | "sheet";
  onClose: () => void;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Drag-to-dismiss for the sheet. The responder is built once, so it reads onClose
  // through a ref rather than closing over a stale prop.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const dragY = useRef(new Animated.Value(0)).current;
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Only claim clearly-downward drags, so a horizontal swipe or a tap still reaches
        // the controls underneath.
        onMoveShouldSetPanResponder: (_e, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_e, g) => {
          // Downward only — dragging up must not lift the sheet off its own bottom edge.
          if (g.dy > 0) dragY.setValue(g.dy);
        },
        onPanResponderRelease: (_e, g) => {
          if (shouldDismissSheet(g.dy, g.vy)) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Animated.timing(dragY, {
              toValue: SHEET_EXIT_DISTANCE,
              duration: prefersReducedMotion() ? 0 : 180,
              useNativeDriver: false,
            }).start(({ finished }) => finished && onCloseRef.current());
          } else {
            Animated.spring(dragY, {
              toValue: 0,
              bounciness: 0,
              useNativeDriver: false,
            }).start();
          }
        },
      }),
    [dragY]
  );

  // A sheet unmounted mid-exit (e.g. the viewport crossing the compact breakpoint) must not
  // fire the exit animation's onClose against the replacement drawer.
  useEffect(() => () => dragY.stopAnimation(), [dragY]);

  // The panel owns its exit as well as its entrance: the page drops it from state the
  // moment onClose fires, so anything that wants an exit animation has to finish it
  // before handing control back.
  const sideRef = useRef<View>(null);
  useLayoutEffect(() => {
    if (variant !== "side") return;
    animateNode(
      sideRef.current,
      [
        { opacity: 0, transform: `translateX(${SIDE_ENTER_DISTANCE}px)` },
        { opacity: 1, transform: "none" },
      ],
      { duration: SIDE_ENTER_MS, easing: EASE_ENTER }
    );
  }, [variant]);

  const closeWithHaptic = useCallback(() => {
    Haptics.selectionAsync();
    const done = () => onCloseRef.current();
    if (variant === "sheet") {
      Animated.timing(dragY, {
        toValue: SHEET_EXIT_DISTANCE,
        duration: prefersReducedMotion() ? 0 : 180,
        useNativeDriver: false,
      }).start(({ finished }) => finished && done());
      return;
    }
    const exit = animateNode(
      sideRef.current,
      [
        { opacity: 1, transform: "none" },
        { opacity: 0, transform: `translateX(${SIDE_ENTER_DISTANCE}px)` },
      ],
      { duration: SIDE_EXIT_MS, easing: EASE_EXIT, fill: "forwards" }
    );
    // No animation to wait on where there is no DOM node, or under reduced motion.
    if (!exit) return done();
    exit.onfinish = done;
  }, [variant, dragY]);

  // The side panel is a non-modal dialog spliced into the page, so it takes focus itself
  // and offers Escape; the list beside it deliberately stays interactive.
  useEffect(() => {
    if (variant !== "side" || Platform.OS !== "web") return;
    (sideRef.current as unknown as HTMLElement | null)?.focus?.();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeWithHaptic();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [variant, closeWithHaptic]);

  const handleSubmit = async (data: BookingFormData) => {
    setSubmitError(null);
    const dateTime = convertLocalToUtc(data.date, data.time, restaurant.timezone || "UTC");
    // For "Any section" (null tableId/sectionId), the server auto-assigns the best table.
    // For explicit selection, fall back to the table's owning section if sectionId wasn't set.
    const resolvedSectionId =
      data.sectionId ??
      (data.tableId !== null
        ? (restaurant.sections.find((s) => s.tables.some((t) => t.id === data.tableId))?.id ?? null)
        : null);
    try {
      const newBooking = await createBooking({
        customerEmail: data.customerEmail,
        customerName: data.customerName,
        seats: data.seats,
        tableId: data.tableId,
        tableGroupId: data.tableGroupId,
        holdId: data.holdId,
        restaurantId: restaurant.id,
        sectionId: resolvedSectionId,
        date: dateTime,
        specialRequests: data.specialRequests || null,
      });
      const email = encodeURIComponent(data.customerEmail);
      if (newBooking?.bookingRef) {
        // Native has no cookie jar, so the diner's own list of recent bookings is kept
        // client-side; on web this is a no-op and the API's HttpOnly cookie still owns it.
        rememberBooking({
          bookingRef: newBooking.bookingRef,
          email: data.customerEmail,
          date: dateTime,
          seats: data.seats,
          restaurantName: restaurant.name,
          createdAt: new Date().toISOString(),
        });
        router.push(`/booking-confirmation/${newBooking.bookingRef}?email=${email}`);
      } else if (newBooking) {
        router.push(`/booking-confirmation/${newBooking.id}?email=${email}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("booking.drawer.genericSubmitError");
      setSubmitError(message);
    }
  };

  const switchableLocations = onRestaurantChange && restaurants && restaurants.length > 1;

  const heading = switchableLocations ? (
    <Select
      accessibilityLabel={t("booking.drawer.locationSelectLabel")}
      selectedValue={restaurant.id}
      options={restaurants.map((r) => ({ label: r.name, value: r.id }))}
      onSelect={(value) => {
        const next = restaurants.find((r) => r.id === value);
        if (next) onRestaurantChange(next);
      }}
    />
  ) : (
    <ThemedText style={styles.title} numberOfLines={1}>
      {restaurant.name}
    </ThemedText>
  );

  const body = (headerHandlers: Partial<GestureResponderHandlers> = {}) => (
    <>
      <View {...headerHandlers} style={[styles.header, { borderBottomColor: colors.border }]}>
        {/* The close button sits on the heading's own row rather than beside the whole
            two-line column, so it centres against the title or the location picker instead
            of riding high against the top of the block. */}
        <View style={styles.headerTop}>
          <View style={styles.headerHeading}>{heading}</View>
          <Pressable
            testID="booking-drawer-close"
            onPress={closeWithHaptic}
            accessibilityRole="button"
            accessibilityLabel={t("booking.drawer.closePanelLabel")}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={[styles.closeBtn, { backgroundColor: colors.surfaceAlt }]}
          >
            <Icon name="close" size="lg" color={colors.muted} />
          </Pressable>
        </View>
        <ThemedText style={[styles.summary, { color: colors.muted }]}>
          {summaryLine(t, seats, date, time, today)}
        </ThemedText>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {submitError && (
          <ThemedView style={styles.errorBanner} role="alert" accessibilityLiveRegion="assertive">
            <ThemedText style={styles.errorText}>{submitError}</ThemedText>
          </ThemedView>
        )}
        <BookingForm
          // Remounting on a new (location, time) resets the hold and the suggested table
          // rather than carrying the old ones over. Party size and date are deliberately not
          // part of the key — both are changed from inside the form, which already releases
          // the hold and re-asks for availability, and remounting on them would throw away a
          // name and email the diner has just typed.
          key={`${restaurant.id}-${time}`}
          layout="drawer"
          restaurant={restaurant}
          seats={seats}
          onSeatsChange={onSeatsChange}
          date={date}
          onDateChange={onDateChange}
          initialTime={time}
          onSubmit={handleSubmit}
        />
      </ScrollView>
    </>
  );

  if (variant === "sheet") {
    return (
      <Modal visible transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.sheetRoot}>
          {/* The sheet is bottom-anchored, so on a device the keyboard would cover the very
              fields the diner is filling in. */}
          <KeyboardAvoider style={styles.sheetRoot}>
            <Pressable
              testID="booking-drawer-backdrop"
              accessibilityRole="button"
              accessibilityLabel={t("booking.drawer.closePanelLabel")}
              style={[styles.backdrop, { backgroundColor: colors.overlay }]}
              onPress={closeWithHaptic}
            />
            <Animated.View
              testID="booking-drawer"
              role="dialog"
              aria-modal
              accessibilityViewIsModal
              accessibilityLabel={t("booking.drawer.bookLocationLabel", { name: restaurant.name })}
              style={[
                styles.sheet,
                { backgroundColor: colors.card, borderTopColor: colors.border },
                // The sheet is the bottom of the screen, so the home indicator and Android's
                // navigation bar land on its last row unless it steps up over them itself.
                Platform.OS !== "web" && { paddingBottom: insets.bottom },
                { transform: [{ translateY: dragY }] },
              ]}
            >
              {/* The handle and the header drag the sheet; the body below them keeps its own
                scrolling, which a whole-sheet responder would fight with. */}
              <View
                {...panResponder.panHandlers}
                testID="booking-drawer-grabber"
                // Drag-to-dismiss duplicates the labeled close button, so the handle stays out
                // of the a11y tree instead of surfacing as an unnamed node.
                aria-hidden
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.grabberArea}
              >
                <View
                  style={[
                    styles.grabber,
                    { backgroundColor: isDark ? "rgba(255,255,255,0.24)" : "rgba(0,0,0,0.18)" },
                  ]}
                />
              </View>
              {body(panResponder.panHandlers)}
            </Animated.View>
          </KeyboardAvoider>
        </View>
      </Modal>
    );
  }

  return (
    <View
      ref={sideRef}
      testID="booking-drawer"
      role="dialog"
      accessibilityLabel={t("booking.drawer.bookLocationLabel", { name: restaurant.name })}
      tabIndex={-1}
      style={[
        styles.side,
        { backgroundColor: colors.card, borderColor: colors.border },
        theme.shadows.popup,
      ]}
    >
      {body()}
    </View>
  );
}
