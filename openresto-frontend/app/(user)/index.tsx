import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { fetchRestaurants, fetchHighlights, RestaurantDto, HighlightDto } from "@/api/restaurants";
import { useEffect, useState, useRef, useCallback, type ReactNode } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import RestaurantCard from "@/components/restaurant/RestaurantCard";
import RestaurantCardSkeleton from "@/components/restaurant/RestaurantCardSkeleton";
import HorizontalScroller from "@/components/common/HorizontalScroller";
import { useAppTheme } from "@/hooks/use-app-theme";
import ScrollToTopFab from "@/components/common/ScrollToTopFab";
import Footer from "@/components/layout/Footer";
import { useScrollToTopFab } from "@/hooks/use-scroll-to-top-fab";
import { CONTENT_MAX_WIDTH, CONTENT_PADDING_H, isMobileWidth } from "@/constants/breakpoints";
import { useTranslation } from "react-i18next";
import { styles } from "@/styles/user/index.styles";
import { hexToRgb } from "@/utils/colors";
import { resolveServerUrl } from "@/utils/serverUrl";
import { Icon, type IconName } from "@/components/common/Icon";

/**
 * Hooks for the scroll-driven large-title collapse in global.css. `dataSet` is
 * react-native-web's data-attribute escape hatch and isn't in React Native's own prop
 * types, so it is spread through a cast the way web-only style properties are elsewhere.
 */
const HOME_SCROLL_TIMELINE = { dataSet: { scrollTimeline: "home" } };
const HERO_COLLAPSE_BOX = { dataSet: { heroCollapse: "box" } };
const HERO_COLLAPSE_TITLE = { dataSet: { heroCollapse: "title" } };
const HERO_COLLAPSE_SUB = { dataSet: { heroCollapse: "sub" } };
/** Marks a location card for the scroll-driven fade in global.css. */
const CARD_REVEAL = { dataSet: { cardReveal: "card" } };

// Module-level cache so data survives route changes — prevents hero layout shift on back-navigation.
let _cachedRestaurants: RestaurantDto[] | null = null;
let _cachedHighlights: HighlightDto[] | null = null;

const DEFAULT_PARTY_SIZE = 2;

const HIGHLIGHT_GAP = 12;
/** Phone rail card, as a fraction of the viewport. */
const PHONE_RAIL_CARD_FRACTION = 0.78;
const PHONE_RAIL_CARD_MAX = 300;
/** Wider rail card, as a fraction of the grid column it replaces. The remainder is the peek. */
const RAIL_CARD_OF_COLUMN = 0.92;
const PHONE_SECTION_PADDING_H = 20;
/** `styles.body`'s compact inset, which the locations grid measures its columns against. */
const PHONE_BODY_PADDING_H = 16;
/** `styles.grid`'s gap. */
const GRID_GAP = 18;
/** Clearance between the status bar and the hero title where the screen has no header. */
const HERO_TOP_GAP = 24;

/**
 * The width of one column in a centred, inset, gapped row.
 *
 * A percentage minus a gap share is a `calc()` expression, and React Native has no `calc`:
 * the string reached native untouched above 600dp, which is every tablet and a phone turned
 * sideways. Measuring against the same column the section is capped to gives one answer both
 * platforms can lay out.
 *
 * @see [index.test.tsx](<../../tests/app/(user)/index.test.tsx>) — pins that a two-column
 * grid gets a number, not a calc string.
 */
export function columnWidth(
  viewport: number,
  insetH: number,
  gap: number,
  columns: number
): number {
  const inner = Math.min(viewport, CONTENT_MAX_WIDTH) - insetH * 2;
  return (inner - gap * (columns - 1)) / columns;
}

export function resetHomeCache() {
  _cachedRestaurants = null;
  _cachedHighlights = null;
}

export default function HomeScreen() {
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>(_cachedRestaurants ?? []);
  const [highlights, setHighlights] = useState<HighlightDto[]>(_cachedHighlights ?? []);
  const [loading, setLoading] = useState(_cachedRestaurants === null);
  const { width } = useWindowDimensions();
  const { brand, colors, primaryColor, isDark } = useAppTheme();
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const fab = useScrollToTopFab();
  const insets = useSafeAreaInsets();

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
  const hasHero = !!brand.headerImageUrl;
  const heroTextShadow = "0 1px 3px rgba(0,0,0,0.55), 0 2px 14px rgba(0,0,0,0.35)";

  const { r: accentR, g: accentG, b: accentB } = hexToRgb(primaryColor);
  const accentSoft = `rgba(${accentR},${accentG},${accentB},0.18)`;

  const heroSubtitle = brand.subtitle?.trim() || t("restaurant.home.heroSubtitle");
  const highlightsHeading =
    brand.highlightsHeading?.trim() || t("restaurant.home.highlightsHeading");
  const highlightsSubheading =
    brand.highlightsSubheading?.trim() || t("restaurant.home.highlightsSubheading");

  // "Contain" shows the whole image (avoids aggressive cropping on mobile); anything else
  // (null unset, or "Cover") keeps today's cover behaviour — no visual regression.
  const heroContain = brand.headerImageFit?.toLowerCase() === "contain";
  const heroObjectFit = heroContain ? "contain" : "cover";
  const heroObjectPosition = heroContain ? "center top" : "center";

  const numColumns = width < 600 ? 1 : width < 1000 ? 2 : 3;
  const numHighlightCols = width < 600 ? 1 : width < 900 ? 2 : 4;

  const bodyInset = isMobile ? PHONE_BODY_PADDING_H : CONTENT_PADDING_H;
  const cardWrapperStyle = [
    styles.cardWrapper,
    numColumns > 1 && {
      width: columnWidth(width, bodyInset, GRID_GAP, numColumns),
      minWidth: 320,
    },
  ];
  // One row's worth, except on a phone: a single card reads as the whole list having
  // loaded and found one location.
  const skeletonCount = numColumns === 1 ? 2 : numColumns;

  /**
   * Highlights stay one row. Past the column count they scroll sideways instead of
   * wrapping, so a fifth highlight doesn't open a second row with three empty slots in it.
   *
   * @see [index.test.tsx](<../../tests/app/(user)/index.test.tsx>) — pins the boundary: four
   * highlights across four columns stay a grid, a fifth becomes a rail.
   */
  const useHighlightRail = numHighlightCols === 1 || highlights.length > numHighlightCols;
  const railInset = isMobile ? PHONE_SECTION_PADDING_H : CONTENT_PADDING_H;
  const highlightColumnWidth = columnWidth(width, railInset, HIGHLIGHT_GAP, numHighlightCols);
  // The card is deliberately narrower than the room it has: the sliver of the next one is
  // what says "this scrolls" without a scrollbar to say it.
  const railCardWidth =
    numHighlightCols === 1
      ? Math.min(PHONE_RAIL_CARD_MAX, Math.round(width * PHONE_RAIL_CARD_FRACTION))
      : Math.round(highlightColumnWidth * RAIL_CARD_OF_COLUMN);

  const wrapHighlights = (cards: ReactNode) =>
    useHighlightRail ? (
      <HorizontalScroller
        testID="highlights-rail"
        label={highlightsHeading}
        // The cards are only focusable when they carry a link, so without a stop of its
        // own a keyboard could reach the third highlight only by luck.
        keyboardFocusable
        // A pointer has no swipe. Past phone widths the row needs a control to say it
        // scrolls; on a phone the gesture is already the one the visitor reaches for.
        scrollButtons={!isMobile}
        snapToInterval={railCardWidth + HIGHLIGHT_GAP}
        decelerationRate="fast"
        style={[
          // The rail runs edge to edge while its cards stay lined up with the section's own
          // padding: the negative margin cancels the inset the highlights block carries, and
          // the content padding puts it back inside the scroller.
          { marginHorizontal: -railInset },
          Platform.OS === "web" &&
            // Without the scroll padding, mandatory snapping pulls the first card flush to
            // the viewport edge on load: the rail's own left inset reads as scrolled-past
            // content, so the browser snaps it away and the row starts out of line with the
            // heading above it.
            ({ scrollSnapType: "x mandatory", scrollPaddingLeft: railInset } as object),
        ]}
        contentContainerStyle={{ ...styles.highlightsRailContent, paddingHorizontal: railInset }}
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
        onScroll={fab.trackScroll}
        scrollEventThrottle={16}
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
                {Platform.OS === "web" ? (
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
                ) : (
                  <Image
                    source={{ uri: resolveServerUrl(brand.headerImageUrl!) }}
                    style={StyleSheet.absoluteFill}
                    contentFit={heroObjectFit}
                    contentPosition={heroContain ? "top center" : "center"}
                    accessible={false}
                  />
                )}
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    Platform.OS === "web"
                      ? ({
                          background: `linear-gradient(160deg, rgba(${accentR},${accentG},${accentB},0.30) 0%, rgba(0,0,0,0.40) 100%)`,
                        } as object)
                      : { backgroundColor: "rgba(0,0,0,0.35)" },
                  ]}
                  pointerEvents="none"
                />
              </>
            )}
            <View
              style={[
                styles.heroInner,
                isMobile && { paddingHorizontal: 20 },
                // This screen is the one guest route that draws with no header (see
                // app/(user)/_layout.tsx), so nothing above it has reserved the status bar
                // and the hero starts at the top of the display. `paddingTop` alone is a web
                // constant sized for the navbar, and lands a few points short of a notch.
                Platform.OS !== "web" && { paddingTop: insets.top + HERO_TOP_GAP },
              ]}
            >
              <View
                {...(HERO_COLLAPSE_BOX as object)}
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
                      hasHero &&
                        Platform.OS === "web" &&
                        ({ textShadow: heroTextShadow } as object),
                    ]}
                  >
                    {highlightsHeading}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.highlightsBy,
                      { color: hasHero ? "rgba(255,255,255,0.82)" : mutedColor },
                      hasHero &&
                        Platform.OS === "web" &&
                        ({ textShadow: heroTextShadow } as object),
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
                        width: highlightColumnWidth,
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
                            <Icon name={h.iconKey as IconName} size="md" color={primaryColor} />
                          </View>
                          <ThemedText style={styles.highlightTitle}>{h.title}</ThemedText>
                          {h.link ? (
                            <Icon
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
                        accessibilityHint={t("restaurant.home.opensInNewTab")}
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
              <ThemedText style={styles.sectionTitle}>
                {t("restaurant.home.locationsHeading")}
              </ThemedText>
            </View>

            <View
              testID={loading ? "loading-screen" : undefined}
              aria-busy={loading}
              accessibilityLabel={loading ? t("restaurant.home.loadingLocations") : undefined}
              style={[styles.grid, numColumns > 1 && styles.rowWrap]}
            >
              {loading
                ? Array.from({ length: skeletonCount }, (_, i) => (
                    <View key={i} style={cardWrapperStyle}>
                      <RestaurantCardSkeleton />
                    </View>
                  ))
                : restaurants.map((r) => (
                    <View key={r.id} style={cardWrapperStyle} {...(CARD_REVEAL as object)}>
                      <RestaurantCard restaurant={r} party={DEFAULT_PARTY_SIZE} />
                    </View>
                  ))}
            </View>
          </View>
        </View>

        <ScrollToTopFab visible={fab.visible} onPress={scrollToTop} />
        <Footer />
      </ScrollView>
    </ThemedView>
  );
}
