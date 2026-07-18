import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAppTheme } from "@/hooks/use-app-theme";
import { theme } from "@/theme/theme";
import { fetchRestaurants, RestaurantDto } from "@/api/restaurants";
import PageContainer from "@/components/layout/PageContainer";
import ScrollToTopFab from "@/components/common/ScrollToTopFab";
import Footer from "@/components/layout/Footer";
import { scrollIntoView } from "@/utils/scrollIntoView";
import LocationListItem from "@/components/restaurant/LocationListItem";

/**
 * The single scrollable Locations list. Each location expands in place with its
 * booking form inline (the old separate booking page is folded in here). Deep
 * links via /locations/[id] pass `highlightId` to auto-expand + scroll to a
 * specific location, with optional `initialTime`/`initialSeats` prefilled.
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

  const scrollRef = useRef<ScrollView>(null);
  // Two anchors per location: the card header (for generic expand) and the
  // booking form area (for slot-press / deep-link, so the form lands fully
  // in view rather than the top of a tall expanded item).
  const itemRefs = useRef<Record<number, View | null>>({});
  const formRefs = useRef<Record<number, View | null>>({});

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  useEffect(() => {
    fetchRestaurants().then((data) => {
      setRestaurants(data);
      setLoading(false);
    });
  }, []);

  const registerRef = useCallback((id: number, ref: View | null) => {
    itemRefs.current[id] = ref;
  }, []);

  const registerFormRef = useCallback((id: number, ref: View | null) => {
    formRefs.current[id] = ref;
  }, []);

  const runScroll = useCallback(
    (refMap: React.RefObject<Record<number, View | null>>, id: number, delay: number) => {
      // Let the accordion's expand animation/layout settle before measuring —
      // the AnimatedAccordion runs a 180ms tween, so we wait past that before
      // measuring the target's final position.
      setTimeout(() => {
        scrollIntoView(
          { current: refMap.current[id] ?? null } as React.RefObject<View | null>,
          scrollRef,
          "start"
        );
      }, delay);
    },
    []
  );

  // Generic expand (button press): scroll the card header to the top so the
  // user keeps the location's name/image as context above the expanded body.
  const handleExpand = useCallback(
    (id: number) => {
      runScroll(itemRefs, id, 150);
    },
    [runScroll]
  );

  // Slot press / deep-link arrival: the user's intent is to *book*, so scroll
  // the form itself into view after the longer settle so the whole form is
  // visible, not just the top of the expanded item.
  const handleScrollToForm = useCallback(
    (id: number) => {
      runScroll(formRefs, id, 220);
    },
    [runScroll]
  );

  if (loading) {
    return (
      <ThemedView style={styles.loadingRoot}>
        <ActivityIndicator testID="loading-screen" size="large" color={primaryColor} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.root}>
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
          </View>

          {restaurants.length === 0 ? (
            <ThemedView style={styles.empty}>
              <ThemedText style={[styles.emptyText, { color: colors.muted }]}>
                No locations yet. Please check back soon.
              </ThemedText>
            </ThemedView>
          ) : (
            <View style={styles.list}>
              {restaurants.map((r) => (
                <LocationListItem
                  key={r.id}
                  restaurant={r}
                  defaultExpanded={highlightId === r.id}
                  initialTime={highlightId === r.id ? initialTime : undefined}
                  initialSeats={highlightId === r.id ? initialSeats : undefined}
                  registerRef={registerRef}
                  registerFormRef={registerFormRef}
                  onExpand={handleExpand}
                  onScrollToForm={handleScrollToForm}
                />
              ))}
            </View>
          )}
        </PageContainer>

        <Footer />
      </ScrollView>

      <ScrollToTopFab scrollY={scrollY} onPress={scrollToTop} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingRoot: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  page: {
    maxWidth: 760,
    gap: 16,
  },
  header: {
    gap: 6,
    marginBottom: 8,
  },
  title: {
    ...theme.typography.h1,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  list: {
    gap: 18,
  },
  empty: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    fontStyle: "italic",
  },
});
