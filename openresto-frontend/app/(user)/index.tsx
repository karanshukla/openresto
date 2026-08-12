import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { fetchRestaurants, fetchHighlights, RestaurantDto, HighlightDto } from "@/api/restaurants";
import {
  useEffect,
  useState,
  useRef,
  useCallback,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Linking, Platform, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { Stack } from "expo-router";
import RestaurantCard from "@/components/restaurant/RestaurantCard";
import RestaurantCardSkeleton from "@/components/restaurant/RestaurantCardSkeleton";
import HorizontalScroller from "@/components/common/HorizontalScroller";
import { useAppTheme } from "@/hooks/use-app-theme";
import { Ionicons } from "@expo/vector-icons";
import ScrollToTopFab, { SHOW_AFTER_SCROLL_Y } from "@/components/common/ScrollToTopFab";
import Footer from "@/components/layout/Footer";
import { isMobileWidth } from "@/constants/breakpoints";
import { styles } from "@/styles/user/index.styles";
import { hexToRgb } from "@/utils/colors";

/**
 * Hooks for the scroll-driven large-title collapse in global.css. `dataSet` is
 * react-native-web's data-attribute escape hatch and isn't in React Native's own prop
 * types, so it is spread through a cast the way web-only style properties are elsewhere.
 */
const HOME_SCROLL_TIMELINE = { dataSet: { scrollTimeline: "home" } };
const HERO_COLLAPSE_TITLE = { dataSet: { heroCollapse: "title" } };
const HERO_COLLAPSE_SUB = { dataSet: { heroCollapse: "sub" } };

// Module-level cache so data survives route changes — prevents hero layout shift on back-navigation.
let _cachedRestaurants: RestaurantDto[] | null = null;
let _cachedHighlights: HighlightDto[] | null = null;

const DEFAULT_PARTY_SIZE = 2;

export function resetHomeCache() {
  _cachedRestaurants = null;
  _cachedHighlights = null;
}

export default function HomeScreen() {
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>(_cachedRestaurants ?? []);
  const [highlights, setHighlights] = useState<HighlightDto[]>(_cachedHighlights ?? []);
  const [loading, setLoading] = useState(_cachedRestaurants === null);
  const [scrollY, setScrollY] = useState(0);
  const { width } = useWindowDimensions();
  const { brand, colors, primaryColor, isDark } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);

  const isMobile = isMobileWidth(width);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  useEffect(() => {
    Promise.all([fetchRestaurants(), fetchHighlights()]).then(([restaurantData, highlightData]) => {
      _cachedRestaurants = restaurantData;
      _cachedHighlights = highlightData;
      setRestaurants(restaurantData);
      setHighlights(highlightData);
      setLoading(false);
    });
  }, []);

  const mutedColor = colors.muted;
  const hasHero = !!brand.headerImageUrl && Platform.OS === "web";
  const heroTextShadow = "0 1px 3px rgba(0,0,0,0.55), 0 2px 14px rgba(0,0,0,0.35)";

  const { r: accentR, g: accentG, b: accentB } = hexToRgb(primaryColor);
  const accentSoft = `rgba(${accentR},${accentG},${accentB},0.18)`;

  const DEFAULT_SUBTITLE =
    "Scroll down to pick a location below, choose a time, enter your email address, and you're booked!";
  const heroSubtitle = brand.subtitle?.trim() || DEFAULT_SUBTITLE;
  const highlightsHeading = brand.highlightsHeading?.trim() || "Restaurant highlights";
  const highlightsSubheading = brand.highlightsSubheading?.trim() || "Curated by the owner";

  // "Contain" shows the whole image (avoids aggressive cropping on mobile); anything else
  // (null unset, or "Cover") keeps today's cover behaviour — no visual regression.
  const heroContain = brand.headerImageFit?.toLowerCase() === "contain";
  const heroObjectFit = heroContain ? "contain" : "cover";
  const heroObjectPosition = heroContain ? "center top" : "center";

  const numColumns = width < 600 ? 1 : width < 1000 ? 2 : 3;
  const numHighlightCols = width < 600 ? 1 : width < 900 ? 2 : 4;

  const cardWrapperStyle = [
    styles.cardWrapper,
    numColumns > 1 && {
      width:
        numColumns === 2
          ? ("calc(50% - 9px)" as unknown as number)
          : ("calc(33.333% - 12px)" as unknown as number),
      minWidth: 320,
    },
  ];
  // One row's worth, except on a phone: a single card reads as the whole list having
  // loaded and found one location.
  const skeletonCount = numColumns === 1 ? 2 : numColumns;

  // The card is deliberately narrower than the viewport: the sliver of the next one is
  // what says "this scrolls" without a scrollbar to say it.
  const railCardWidth = Math.min(300, Math.round(width * 0.78));
  const railGap = 12;
  const useHighlightRail = numHighlightCols === 1;

  const wrapHighlights = (cards: ReactNode) =>
    useHighlightRail ? (
      <HorizontalScroller
        testID="highlights-rail"
        label={highlightsHeading}
        // The cards are only focusable when they carry a link, so without a stop of its
        // own a keyboard could reach the third highlight only by luck.
        keyboardFocusable
        scrollButtons={false}
        snapToInterval={railCardWidth + railGap}
        decelerationRate="fast"
        style={[
          styles.highlightsRail,
          Platform.OS === "web" &&
            // Without the scroll padding, mandatory snapping pulls the first card flush to
            // the viewport edge on load: the rail's own left inset reads as 20px of
            // scrolled-past content, so the browser snaps it away and the row starts out
            // of line with the heading above it.
            ({ scrollSnapType: "x mandatory", scrollPaddingLeft: 20 } as object),
        ]}
        contentContainerStyle={styles.highlightsRailContent}
      >
        {cards}
      </HorizontalScroller>
    ) : (
      <View style={[styles.highlightsGrid, styles.rowWrap]}>{cards}</View>
    );

  return (
    <ThemedView style={styles.root}>
      {Platform.OS !== "web" && <Stack.Screen options={{ title: brand.appName }} />}

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={100}
        {...(HOME_SCROLL_TIMELINE as object)}
      >
        <View style={{ flex: 1 }}>
          <View
            style={[
              styles.hero,
              {
                backgroundColor: colors.card,
                borderBottomColor: colors.border,
                ...(!hasHero &&
                  Platform.OS === "web" &&
                  ({
                    background: isDark
                      ? `radial-gradient(80% 90% at 90% 10%, ${accentSoft}, transparent 60%), radial-gradient(60% 80% at 10% 100%, rgba(${accentR},${accentG},${accentB},0.12), transparent 60%), linear-gradient(180deg, ${colors.card} 0%, ${colors.page} 100%)`
                      : `radial-gradient(80% 90% at 90% 10%, ${accentSoft}, transparent 60%), linear-gradient(180deg, ${colors.card} 0%, ${colors.page} 100%)`,
                  } as object)),
              },
            ]}
          >
            {hasHero && (
              <>
                <img
                  src={brand.headerImageUrl!}
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: heroObjectFit,
                    objectPosition: heroObjectPosition,
                    pointerEvents: "none",
                  }}
                />
                <View
                  style={[
                    { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
                    {
                      background: `linear-gradient(160deg, rgba(${accentR},${accentG},${accentB},0.30) 0%, rgba(0,0,0,0.40) 100%)`,
                    } as object,
                  ]}
                  pointerEvents="none"
                />
              </>
            )}
            <View style={[styles.heroInner, isMobile && { paddingHorizontal: 20 }]}>
              <View
                style={[
                  styles.heroTextPill,
                  hasHero && {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: 12,
                    borderWidth: 1,
                    padding: 16,
                  },
                ]}
              >
                <ThemedText
                  {...(HERO_COLLAPSE_TITLE as object)}
                  style={[styles.heroTitle, isMobile && { fontSize: 40, lineHeight: 44 }]}
                >
                  {brand.appName}
                </ThemedText>
                <ThemedText
                  {...(HERO_COLLAPSE_SUB as object)}
                  style={[styles.heroSub, { color: mutedColor }]}
                >
                  {heroSubtitle}
                </ThemedText>
              </View>
            </View>

            {/* Hide the whole section (heading included) when no highlights exist. */}
            {highlights.length > 0 && (
              <View style={[styles.highlights, isMobile && { paddingHorizontal: 20 }]}>
                <View style={styles.highlightsHead}>
                  <ThemedText
                    style={[
                      styles.highlightsLabel,
                      { color: hasHero ? "rgba(255,255,255,0.92)" : mutedColor },
                      hasHero && ({ textShadow: heroTextShadow } as object),
                    ]}
                  >
                    {highlightsHeading}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.highlightsBy,
                      { color: hasHero ? "rgba(255,255,255,0.82)" : mutedColor },
                      hasHero && ({ textShadow: heroTextShadow } as object),
                    ]}
                  >
                    {highlightsSubheading}
                  </ThemedText>
                </View>
                {wrapHighlights(
                  highlights.map((h) => {
                    const cardStyle = [
                      styles.highlightCard,
                      { backgroundColor: colors.card, borderColor: colors.border },
                      numHighlightCols > 1 && {
                        width:
                          numHighlightCols === 2
                            ? ("calc(50% - 6px)" as unknown as number)
                            : ("calc(25% - 9px)" as unknown as number),
                        minWidth: 200,
                      },
                      useHighlightRail && {
                        width: railCardWidth,
                        ...(Platform.OS === "web"
                          ? ({ scrollSnapAlign: "start" } as object)
                          : null),
                      },
                      // A linked card reads as interactive: lift it slightly.
                      h.link && { cursor: "pointer" as const },
                    ];
                    const cardContent = (
                      <>
                        <View style={styles.highlightHeader}>
                          <View
                            style={[
                              styles.highlightIconBox,
                              {
                                backgroundColor: `rgba(${accentR},${accentG},${accentB},0.18)`,
                              },
                            ]}
                          >
                            <Ionicons
                              name={h.iconKey as ComponentProps<typeof Ionicons>["name"]}
                              size={16}
                              color={primaryColor}
                            />
                          </View>
                          <ThemedText style={styles.highlightTitle}>{h.title}</ThemedText>
                          {h.link ? (
                            <Ionicons
                              name="open-outline"
                              size={13}
                              color={mutedColor}
                              style={{ marginLeft: "auto" }}
                            />
                          ) : null}
                        </View>
                        <ThemedText style={[styles.highlightBody, { color: mutedColor }]}>
                          {h.body}
                        </ThemedText>
                      </>
                    );
                    return h.link ? (
                      <Pressable
                        key={h.id}
                        accessibilityRole="link"
                        accessibilityLabel={`${h.title}. ${h.body}`}
                        accessibilityHint="Opens in a new tab"
                        onPress={() => Linking.openURL(h.link!)}
                        style={cardStyle}
                      >
                        {cardContent}
                      </Pressable>
                    ) : (
                      <View key={h.id} style={cardStyle}>
                        {cardContent}
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </View>

          <View style={[styles.body, isMobile && { paddingHorizontal: 16 }]}>
            <View style={styles.sectionHead}>
              <ThemedText style={styles.sectionTitle}>Our locations</ThemedText>
            </View>

            <View
              testID={loading ? "loading-screen" : undefined}
              aria-busy={loading}
              accessibilityLabel={loading ? "Loading locations" : undefined}
              style={[styles.grid, numColumns > 1 && styles.rowWrap]}
            >
              {loading
                ? Array.from({ length: skeletonCount }, (_, i) => (
                    <View key={i} style={cardWrapperStyle}>
                      <RestaurantCardSkeleton />
                    </View>
                  ))
                : restaurants.map((r) => (
                    <View key={r.id} style={cardWrapperStyle}>
                      <RestaurantCard restaurant={r} party={DEFAULT_PARTY_SIZE} />
                    </View>
                  ))}
            </View>
          </View>
        </View>

        <Footer />
      </ScrollView>

      <ScrollToTopFab visible={scrollY > SHOW_AFTER_SCROLL_Y} onPress={scrollToTop} />
    </ThemedView>
  );
}
