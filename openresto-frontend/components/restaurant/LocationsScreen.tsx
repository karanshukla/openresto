import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View, useWindowDimensions } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAppTheme } from "@/hooks/use-app-theme";
import { fetchRestaurants, RestaurantDto } from "@/api/restaurants";
import PageContainer from "@/components/layout/PageContainer";
import ScrollToTopFab from "@/components/common/ScrollToTopFab";
import Footer from "@/components/layout/Footer";
import { scrollIntoView } from "@/utils/scrollIntoView";
import { getRestaurantDate } from "@/utils/restaurantTime";
import { CONTENT_MAX_WIDTH, CONTENT_PADDING_H, isMobileWidth } from "@/constants/breakpoints";
import LocationListItem from "@/components/restaurant/LocationListItem";
import LocationsFilterBar, { type MealWindow } from "@/components/restaurant/LocationsFilterBar";
import BookingDrawer from "@/components/booking/BookingDrawer";
import { styles } from "./LocationsScreen.styles";

/** What the user is currently booking: a location plus the time they tapped. */
interface DrawerTarget {
  restaurant: RestaurantDto;
  time: string;
}

export function availabilitySummary(
  counts: Record<number, number | null>,
  total: number
): string | null {
  const reported = Object.values(counts);
  if (total === 0 || reported.length < total) return null;
  if (reported.some((c) => c === null)) return "Checking availability…";
  const withTables = reported.filter((c) => (c ?? 0) > 0).length;
  if (total === 1) return withTables === 1 ? "Tables available" : "No tables at this time";
  return `${withTables} of ${total} location${total === 1 ? "" : "s"} have tables`;
}

/**
 * The Locations list. Party size, date and meal window live here rather than inside each
 * location's booking form, so every card is answering the same question and the list can
 * be read as a comparison. Picking a time opens {@link BookingDrawer} beside the list
 * (or as a sheet on phones) instead of expanding the card and pushing the rest away.
 *
 * Deep links via /locations/[id] pass `highlightId` to scroll to and expand a specific
 * location; when they also carry a time, the drawer opens straight onto it.
 */
export default function LocationsScreen({
  highlightId,
  initialTime,
  initialSeats,
}: {
  highlightId?: number;
  initialTime?: string;
  initialSeats?: number;
}) {
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [scrollY, setScrollY] = useState(0);
  const { colors, primaryColor } = useAppTheme();
  const { width } = useWindowDimensions();
  const isCompact = isMobileWidth(width);

  const [seats, setSeats] = useState(initialSeats ?? 2);
  const [date, setDate] = useState<string | null>(null);
  const [meal, setMeal] = useState<MealWindow>("All");
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);
  const [availability, setAvailability] = useState<Record<number, number | null>>({});

  const scrollRef = useRef<ScrollView>(null);
  const itemRefs = useRef<Record<number, View | null>>({});
  const didDeepLink = useRef(false);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  useEffect(() => {
    fetchRestaurants().then((data) => {
      setRestaurants(data);
      // Every location under one brand shares a clock for the purposes of this page;
      // the first location's timezone is what "today" means in the filter bar.
      setDate(getRestaurantDate(data[0]?.timezone ?? "UTC"));
      setLoading(false);
    });
  }, []);

  const today = useMemo(() => getRestaurantDate(restaurants[0]?.timezone ?? "UTC"), [restaurants]);

  const registerRef = useCallback((id: number, ref: View | null) => {
    itemRefs.current[id] = ref;
  }, []);

  const scrollToItem = useCallback((id: number, delay: number) => {
    // Let the accordion's 180ms expand tween settle before measuring the target.
    setTimeout(() => {
      scrollIntoView(
        { current: itemRefs.current[id] ?? null } as React.RefObject<View | null>,
        scrollRef,
        "start"
      );
    }, delay);
  }, []);

  const handleExpand = useCallback(
    (id: number) => {
      scrollToItem(id, 150);
    },
    [scrollToItem]
  );

  const handleAvailability = useCallback((id: number, count: number | null) => {
    setAvailability((prev) => (prev[id] === count ? prev : { ...prev, [id]: count }));
  }, []);

  const handleBook = useCallback((restaurant: RestaurantDto, time: string) => {
    setDrawer({ restaurant, time });
  }, []);

  const closeDrawer = useCallback(() => setDrawer(null), []);

  // Deep link: scroll the highlighted location into view, and when the link carried a
  // time, open its booking drawer straight away — that link's intent is to book.
  useEffect(() => {
    if (loading || didDeepLink.current || !highlightId) return;
    const target = restaurants.find((r) => r.id === highlightId);
    if (!target) return;
    didDeepLink.current = true;
    scrollToItem(highlightId, 220);
    if (initialTime) setDrawer({ restaurant: target, time: initialTime });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, restaurants, highlightId, initialTime]);

  if (loading || !date) {
    return (
      <ThemedView style={styles.loadingRoot}>
        <ActivityIndicator testID="loading-screen" size="large" color={primaryColor} />
      </ThemedView>
    );
  }

  const summary = availabilitySummary(availability, restaurants.length);
  // Desktop keeps the drawer as a column beside the list so the comparison stays visible;
  // phones don't have the room, so it becomes a bottom sheet over the page.
  const sideDrawer = drawer && !isCompact;
  // Where the navbar's own content ends: its column is capped at CONTENT_MAX_WIDTH but
  // tracks the viewport below that, and it insets its contents by CONTENT_PADDING_H
  // either side. Matching it is what puts the drawer's edge under the overflow menu.
  const contentWidth = Math.min(width, CONTENT_MAX_WIDTH) - CONTENT_PADDING_H * 2;

  return (
    <ThemedView style={styles.root}>
      {/* With the drawer open the page becomes two panes, so it caps itself to the app's
          inner content width — the drawer's right edge then lands on the same line as the
          navbar's overflow menu. Left full-bleed it would sit against the far edge of a
          wide monitor instead, detached from the chrome above and below it. Closed, the
          list stays full-bleed exactly as every other screen is. */}
      <View
        testID="locations-row"
        style={[styles.row, sideDrawer && [styles.rowWithDrawer, { maxWidth: contentWidth }]]}
      >
        <View style={styles.listColumn}>
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
            scrollEventThrottle={100}
          >
            <PageContainer style={styles.page}>
              <View style={styles.header}>
                <ThemedText style={styles.title}>Our locations</ThemedText>
                <ThemedText style={[styles.subtitle, { color: colors.muted }]}>
                  Pick a time and we&rsquo;ll hold the table for five minutes.
                </ThemedText>
              </View>

              {restaurants.length === 0 ? (
                <ThemedView style={styles.empty}>
                  <ThemedText style={[styles.emptyText, { color: colors.muted }]}>
                    No locations yet. Please check back soon.
                  </ThemedText>
                </ThemedView>
              ) : (
                <>
                  <LocationsFilterBar
                    seats={seats}
                    onSeatsChange={setSeats}
                    date={date}
                    onDateChange={setDate}
                    today={today}
                    meal={meal}
                    onMealChange={setMeal}
                    summary={summary}
                    compact={isCompact}
                  />

                  <View style={styles.list}>
                    {restaurants.map((r) => (
                      <LocationListItem
                        key={r.id}
                        restaurant={r}
                        seats={seats}
                        date={date}
                        meal={meal}
                        today={today}
                        compact={isCompact}
                        defaultExpanded={highlightId === r.id && !initialTime}
                        registerRef={registerRef}
                        onExpand={handleExpand}
                        onBook={handleBook}
                        onAvailabilityChange={handleAvailability}
                      />
                    ))}
                  </View>
                </>
              )}
            </PageContainer>

            <Footer />
          </ScrollView>

          <ScrollToTopFab scrollY={scrollY} onPress={scrollToTop} />
        </View>

        {sideDrawer && (
          <BookingDrawer
            restaurant={drawer.restaurant}
            seats={seats}
            date={date}
            time={drawer.time}
            today={today}
            variant="side"
            onClose={closeDrawer}
          />
        )}
      </View>

      {drawer && isCompact && (
        <BookingDrawer
          restaurant={drawer.restaurant}
          seats={seats}
          date={date}
          time={drawer.time}
          today={today}
          variant="sheet"
          onClose={closeDrawer}
        />
      )}
    </ThemedView>
  );
}
