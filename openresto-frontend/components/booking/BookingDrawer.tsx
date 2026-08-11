import { useEffect, useRef, useState } from "react";
import { Animated, Modal, PanResponder, Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAppTheme } from "@/hooks/use-app-theme";
import { theme } from "@/theme/theme";
import { RestaurantDto } from "@/api/restaurants";
import { createBooking } from "@/api/bookings";
import { convertLocalToUtc } from "@/utils/date";
import BookingForm, { BookingFormData } from "@/components/booking/BookingForm";
import { styles } from "./BookingDrawer.styles";

export { DRAWER_WIDTH } from "./BookingDrawer.styles";

/** How far the sheet animates before it is considered gone. */
const SHEET_EXIT_DISTANCE = 800;
/** How far the side panel travels as it fades in and out. */
const SIDE_ENTER_DISTANCE = 28;
const SIDE_ENTER_MS = 200;
const SIDE_EXIT_MS = 160;

/**
 * Whether a drag on the sheet's handle should dismiss it: either dragged far enough to
 * read as deliberate, or flicked down hard enough that a short drag still means "go away".
 */
export function shouldDismissSheet(dy: number, vy: number): boolean {
  return dy > 120 || (dy > 40 && vy > 0.7);
}

function summaryLine(seats: number, date: string, time: string, today: string): string {
  const when =
    date === today
      ? "Today"
      : new Date(date + "T12:00:00").toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
  return `${seats} ${seats === 1 ? "guest" : "guests"} · ${when} · ${time}`;
}

/**
 * Booking surface for the Locations list: a side panel on desktop, a bottom sheet on
 * phones. It exists so choosing a time doesn't push the list of locations off-screen —
 * the comparison stays put while the booking happens beside it.
 *
 * Party size, date and the tapped time arrive already decided, so the panel opens with a
 * hold in flight. Party size and date stay adjustable here, and a change is handed back to
 * the page: the bar is the first pass at them, the booking is where they get settled.
 */
export default function BookingDrawer({
  restaurant,
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
  const { colors, isDark } = useAppTheme();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Drag-to-dismiss for the sheet. The responder is built once, so it reads onClose
  // through a ref rather than closing over a stale prop.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const dragY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
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
            duration: 180,
            useNativeDriver: false,
          }).start(() => onCloseRef.current());
        } else {
          Animated.spring(dragY, {
            toValue: 0,
            bounciness: 0,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  // The panel owns its exit as well as its entrance: the page drops it from state the
  // moment onClose fires, so anything that wants an exit animation has to finish it
  // before handing control back.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: SIDE_ENTER_MS,
      useNativeDriver: false,
    }).start();
  }, [enter]);

  const closeWithHaptic = () => {
    Haptics.selectionAsync();
    const exit =
      variant === "sheet"
        ? Animated.timing(dragY, {
            toValue: SHEET_EXIT_DISTANCE,
            duration: 180,
            useNativeDriver: false,
          })
        : Animated.timing(enter, {
            toValue: 0,
            duration: SIDE_EXIT_MS,
            useNativeDriver: false,
          });
    exit.start(() => onCloseRef.current());
  };

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
        router.push(`/booking-confirmation/${newBooking.bookingRef}?email=${email}`);
      } else if (newBooking) {
        router.push(`/booking-confirmation/${newBooking.id}?email=${email}`);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setSubmitError(message);
    }
  };

  const body = (headerHandlers: object = {}) => (
    <>
      <View {...headerHandlers} style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerText}>
          <ThemedText style={styles.title} numberOfLines={1}>
            {restaurant.name}
          </ThemedText>
          <ThemedText style={[styles.summary, { color: colors.muted }]}>
            {summaryLine(seats, date, time, today)}
          </ThemedText>
        </View>
        <Pressable
          testID="booking-drawer-close"
          onPress={closeWithHaptic}
          accessibilityRole="button"
          accessibilityLabel="Close booking panel"
          style={[styles.closeBtn, { backgroundColor: isDark ? "#1b1e23" : "#f3efe6" }]}
        >
          <Ionicons name="close" size={18} color={colors.muted} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {submitError && (
          <ThemedView style={styles.errorBanner}>
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
          <Pressable
            testID="booking-drawer-backdrop"
            style={[styles.backdrop, { backgroundColor: colors.overlay }]}
            onPress={closeWithHaptic}
          />
          <Animated.View
            testID="booking-drawer"
            style={[
              styles.sheet,
              { backgroundColor: colors.card, borderTopColor: colors.border },
              { transform: [{ translateY: dragY }] },
            ]}
          >
            {/* The handle and the header drag the sheet; the body below them keeps its own
                scrolling, which a whole-sheet responder would fight with. */}
            <View
              {...panResponder.panHandlers}
              testID="booking-drawer-grabber"
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
        </View>
      </Modal>
    );
  }

  return (
    <Animated.View
      testID="booking-drawer"
      style={[
        styles.side,
        { backgroundColor: colors.card, borderColor: colors.border },
        theme.shadows.popup,
        {
          opacity: enter,
          transform: [
            {
              translateX: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [SIDE_ENTER_DISTANCE, 0],
              }),
            },
          ],
        },
      ]}
    >
      {body()}
    </Animated.View>
  );
}
