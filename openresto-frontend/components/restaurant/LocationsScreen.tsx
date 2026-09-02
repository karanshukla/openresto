import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  View,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAppTheme } from "@/hooks/use-app-theme";
import { fetchRestaurants, RestaurantDto } from "@/api/restaurants";
import PageContainer from "@/components/layout/PageContainer";
import PageLoader from "@/components/common/PageLoader";
import ScrollToTopFab from "@/components/common/ScrollToTopFab";
import Footer from "@/components/layout/Footer";
import { useScrollToTopFab } from "@/hooks/use-scroll-to-top-fab";
import { scrollIntoView } from "@/utils/scrollIntoView";
import { getRestaurantDate } from "@/utils/restaurantTime";
import { CONTENT_MAX_WIDTH, CONTENT_PADDING_H, isMobileWidth } from "@/constants/breakpoints";
import { DRAWER_WIDTH } from "@/components/booking/BookingDrawer.styles";
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
  if (reported.some((c) => c === null))
    return i18n.t("restaurant.locationsScreen.checkingAvailability");
  const withTables = reported.filter((c) => (c ?? 0) > 0).length;
  if (total === 1)
    return withTables === 1
      ? i18n.t("restaurant.locationsScreen.tablesAvailable")
      : i18n.t("restaurant.locationsScreen.noTablesAtThisTime");
  return i18n.t("restaurant.locationsScreen.availabilitySummary", { count: total, withTables });
}

/**
 * Deep links via /locations/[id] pass `highlightId` to scroll to and expand a specific
 * location; when they also carry a time, the drawer opens straight onto it as well —
 * arriving from a time press on the home page should still show the location the diner
 * picked, not just a booking panel detached from it.
 */
/** Narrowest list worth reading beside the drawer; below it the two panes stop being two. */
const MIN_LIST_WIDTH = 360;

/**
 * Whether the drawer fits *beside* the list rather than over it. The drawer is a fixed
 * `DRAWER_WIDTH` that never shrinks, so the question is one of arithmetic, not of device
 * class: gating on the phone breakpoint gave an ~800dp tablet in portrait both panes and left
 * the list under 300dp, where the cards overflow their column instead of reflowing.
 *
 * @see [LocationsScreen.test.tsx](../../tests/components/restaurant/LocationsScreen.test.tsx)
 * — pins the boundary either side: the split at the width that fits, the sheet one dp under.
 */
export function splitFits(width: number): boolean {
  return width >= DRAWER_WIDTH + MIN_LIST_WIDTH + CONTENT_PADDING_H * 2;
}

export default function LocationsScreen({
  highlightId,
  initialTime,
  initialSeats,
}: {
  highlightId?: number;
  initialTime?: string;
  initialSeats?: number;
}) {
  const { t } = useTranslation();
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  // Raw scroll offsets live in refs; state holds only the booleans the UI reacts to, so
  // scrolling re-renders the list on transitions instead of every scroll event.
  const [filterPinned, setFilterPinned] = useState(false);
  const fab = useScrollToTopFab();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const isCompact = isMobileWidth(width);
  const pageRgb = useMemo(() => hexToRgb(colors.page), [colors.page]);

  const [seats, setSeats] = useState(initialSeats ?? 2);
  const [dateOverride, setDateOverride] = useState<string | null>(null);
  const [meal, setMeal] = useState<MealWindow>("All");
  const [drawer, setDrawer] = useState<DrawerTarget | null>(null);
  /**
   * Two panes rather than an overlay, so the drawer takes its width off everything in the
   * list column — the footer included, which is why the footer moves out from under the
   * list to sit beneath both panes instead.
   *
   * @see [LocationsScreen.test.tsx](../../tests/components/restaurant/LocationsScreen.test.tsx)
   * — pins that the footer leaves the column for the side drawer and stays for the sheet.
   */
  const sideDrawer = Boolean(drawer) && splitFits(width);
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

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setFilterPinned(e.nativeEvent.contentOffset.y > filterTop.current);
      fab.trackScroll(e);
    },
    [fab]
  );

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
          {t("restaurant.locationsScreen.couldntLoad")}
        </ThemedText>
        <Button variant="secondary" size="md" onPress={loadRestaurants}>
          {t("restaurant.locationsScreen.tryAgain")}
        </Button>
      </ThemedView>
    );
  }

  const summary = availabilitySummary(availability, restaurants.length);
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
            scrollEventThrottle={16}
          >
            <PageContainer style={styles.page}>
              <View style={styles.header}>
                <ThemedText style={styles.title}>
                  {t("restaurant.locationsScreen.title")}
                </ThemedText>
                <ThemedText style={[styles.subtitle, { color: colors.muted }]}>
                  {t("restaurant.locationsScreen.subtitle")}
                </ThemedText>
              </View>

              {restaurants.length === 0 ? (
                <ThemedView style={styles.empty}>
                  <ThemedText style={[styles.emptyText, { color: colors.muted }]}>
                    {t("restaurant.locationsScreen.noLocationsYet")}
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

            <ScrollToTopFab visible={fab.visible} onPress={scrollToTop} />
            {!sideDrawer && <Footer />}
          </ScrollView>
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
            variant={splitFits(width) ? "side" : "sheet"}
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
