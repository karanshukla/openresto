import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAppTheme } from "@/hooks/use-app-theme";
import { fetchRestaurants, RestaurantDto } from "@/api/restaurants";
import PageContainer from "@/components/layout/PageContainer";
import PageLoader from "@/components/common/PageLoader";
import ScrollToTopFab, { SHOW_AFTER_SCROLL_Y } from "@/components/common/ScrollToTopFab";
import Footer from "@/components/layout/Footer";
import { scrollIntoView } from "@/utils/scrollIntoView";
import { getRestaurantDate } from "@/utils/restaurantTime";
import { CONTENT_MAX_WIDTH, CONTENT_PADDING_H, isMobileWidth } from "@/constants/breakpoints";
import LocationListItem from "@/components/restaurant/LocationListItem";
import LocationsFilterBar, { type MealWindow } from "@/components/restaurant/LocationsFilterBar";
import BookingDrawer from "@/components/booking/BookingDrawer";
import Button from "@/components/common/Button";
import { hexToRgb } from "@/utils/colors";
import { styles, pinnedMask } from "./LocationsScreen.styles";

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
 * Deep links via /locations/[id] pass `highlightId` to scroll to and expand a specific
 * location; when they also carry a time, the drawer opens straight onto it as well —
 * arriving from a time press on the home page should still show the location the diner
 * picked, not just a booking panel detached from it.
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
  const [loadFailed, setLoadFailed] = useState(false);
  // Raw scroll offsets live in refs; state holds only the booleans the UI reacts to, so
  // scrolling re-renders the list on transitions instead of every scroll event.
  const [filterPinned, setFilterPinned] = useState(false);
  const [fabVisible, setFabVisible] = useState(false);
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const isCompact = isMobileWidth(width);
  const pageRgb = useMemo(() => hexToRgb(colors.page), [colors.page]);

  const [seats, setSeats] = useState(initialSeats ?? 2);
  const [dateOverride, setDateOverride] = useState<string | null>(null);
  const [meal, setMeal] = useState<MealWindow>("All");
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);
  const [availability, setAvailability] = useState<Record<number, number | null>>({});
  // Where the filter bar's band sits in the unscrolled list, so the page can tell a pinned
  // bar from one still sitting under the heading and only draw its edge once it is pinned.
  const filterTop = useRef(0);

  const scrollRef = useRef<ScrollView>(null);
  const itemRefs = useRef<Record<number, View | null>>({});
  const didDeepLink = useRef(false);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    setFilterPinned(y > filterTop.current);
    setFabVisible(y > SHOW_AFTER_SCROLL_Y);
  }, []);

  const loadRestaurants = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    fetchRestaurants()
      .then((data) => {
        setRestaurants(data);
        setLoading(false);
      })
      .catch(() => {
        setLoadFailed(true);
        setLoading(false);
      });
  }, []);

  useEffect(loadRestaurants, [loadRestaurants]);

  // Every location under one brand shares a clock for the purposes of this page;
  // the first location's timezone is what "today" means in the filter bar.
  const today = useMemo(() => getRestaurantDate(restaurants[0]?.timezone ?? "UTC"), [restaurants]);
  const date = dateOverride ?? today;

  const registerRef = useCallback((id: number, ref: View | null) => {
    itemRefs.current[id] = ref;
  }, []);

  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (scrollTimer.current) clearTimeout(scrollTimer.current);
    },
    []
  );

  const scrollToItem = useCallback((id: number, delay: number) => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    // let the accordion's expand tween settle before measuring
    scrollTimer.current = setTimeout(() => {
      scrollIntoView({ current: itemRefs.current[id] ?? null }, scrollRef, { block: "start" });
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

  // Switching location keeps the time the diner was looking at; the form re-asks for
  // availability and moves to the nearest bookable slot when the new location can't take it.
  const handleDrawerRestaurantChange = useCallback((restaurant: RestaurantDto) => {
    setDrawer((current) => (current ? { ...current, restaurant } : current));
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

  if (loading) {
    return <PageLoader />;
  }

  if (loadFailed) {
    return (
      <ThemedView style={styles.loadingRoot}>
        <ThemedText
          role="alert"
          accessibilityLiveRegion="assertive"
          style={[styles.emptyText, { color: colors.muted }]}
        >
          Couldn&rsquo;t load our locations. Please check your connection and try again.
        </ThemedText>
        <Button variant="secondary" size="md" onPress={loadRestaurants}>
          Try again
        </Button>
      </ThemedView>
    );
  }

  const summary = availabilitySummary(availability, restaurants.length);
  /**
   * Two panes rather than an overlay, so the drawer takes its width off everything in the
   * list column — the footer included, which is why the footer moves out from under the
   * list to sit beneath both panes instead.
   *
   * @see [LocationsScreen.test.tsx](../../tests/components/restaurant/LocationsScreen.test.tsx)
   * — pins that the footer leaves the column for the side drawer and stays for the sheet.
   */
  const sideDrawer = Boolean(drawer) && !isCompact;
  // Where the navbar's own content ends: its column is capped at CONTENT_MAX_WIDTH but
  // tracks the viewport below that, and it insets its contents by CONTENT_PADDING_H
  // either side. Matching it is what puts the drawer's edge under the overflow menu.
  const contentWidth = Math.min(width, CONTENT_MAX_WIDTH) - CONTENT_PADDING_H * 2;

  return (
    <ThemedView style={styles.root}>
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
            onScroll={handleScroll}
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
                  <View
                    testID="locations-filter-sticky"
                    onLayout={(e) => {
                      filterTop.current = e.nativeEvent.layout.y;
                    }}
                    style={[styles.filterSticky, filterPinned && pinnedMask(pageRgb)]}
                  >
                    <LocationsFilterBar
                      seats={seats}
                      onSeatsChange={setSeats}
                      date={date}
                      onDateChange={setDateOverride}
                      today={today}
                      meal={meal}
                      onMealChange={setMeal}
                      summary={summary}
                      compact={isCompact}
                      raised={filterPinned}
                    />
                  </View>

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
                        defaultExpanded={highlightId === r.id}
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

            {!sideDrawer && <Footer />}
          </ScrollView>

          <ScrollToTopFab visible={fabVisible} onPress={scrollToTop} />
        </View>

        {drawer && (
          <BookingDrawer
            restaurant={drawer.restaurant}
            restaurants={restaurants}
            onRestaurantChange={handleDrawerRestaurantChange}
            seats={seats}
            date={date}
            time={drawer.time}
            today={today}
            variant={isCompact ? "sheet" : "side"}
            onSeatsChange={setSeats}
            onDateChange={setDateOverride}
            onClose={closeDrawer}
          />
        )}
      </View>

      {sideDrawer && <Footer />}
    </ThemedView>
  );
}
