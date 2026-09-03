import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { fetchRestaurants, fetchHighlights, RestaurantDto, HighlightDto } from "@/api/restaurants";
import { useEffect, useState, useRef, useCallback, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useFocusEffect } from "expo-router";
import RestaurantCard from "@/components/restaurant/RestaurantCard";
import RestaurantCardSkeleton from "@/components/restaurant/RestaurantCardSkeleton";
import HorizontalScroller from "@/components/common/HorizontalScroller";
import { useAppTheme } from "@/hooks/use-app-theme";
import ScrollToTopFab from "@/components/common/ScrollToTopFab";
import Footer from "@/components/layout/Footer";
import { useScrollToTopFab } from "@/hooks/use-scroll-to-top-fab";
import { useTabBarClearance } from "@/hooks/use-tab-bar-clearance";
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
 * The band `GuestSettingsAnchor` pins the settings control in over the hero off web. The hero
 * title clears the whole band rather than sharing its line: at 40px the title can run a
 * phone's full width.
 */
const HERO_SETTINGS_ROW = 40;
/** Bloom diameter as a fraction of the hero's width, matching the web gradient's extent. */
const HERO_BLOOM_SPAN = 0.9;
/** Concentric discs standing in for one radial stop's falloff, as fractions of that span. */
const HERO_BLOOM_RINGS = [1, 0.68, 0.42];
/** Where the web gradient centres each bloom, and the alpha it reaches there. */
const HERO_BLOOMS = [
  { key: "corner", left: "90%", top: "10%", peak: 0.18, darkOnly: false },
  { key: "floor", left: "10%", top: "100%", peak: 0.12, darkOnly: true },
] as const;
/**
 * Steps in the hero's card → page settle. Ten keeps each step below one shade of the two
 * surfaces it runs between, which is what stops a stack of flat bands reading as banding.
 */
const HERO_FADE_STEPS = 10;

/** How far a location card rises into place as the list lands. */
const CARD_REVEAL_RISE = 14;
const CARD_REVEAL_MS = 260;
const CARD_REVEAL_STAGGER_MS = 55;
/** Cards past this share the last delay, so a long list doesn't land in slow motion. */
const CARD_REVEAL_MAX_STAGGER = 5;

/**
 * The per-ring alpha whose stack reaches `peak` at a bloom's centre. Translucent layers
 * compose as 1 − Π(1 − aᵢ), so an even split is the inverse nth root, not `peak / rings`.
 *
 * @see [index.test.tsx](<../../../tests/app/(user)/index.test.tsx>) — pins that the rings
 * compose back to the peak rather than to an even division of it.
 */
export function bloomRingAlpha(peak: number, rings: number): number {
  return 1 - Math.pow(1 - peak, 1 / rings);
}

/**
 * The blooms the hero paints. The web gradient carries a second one up from the floor only in
 * the dark theme, where a light hero would otherwise have nothing to sit against.
 *
 * @see [index.test.tsx](<../../../tests/app/(user)/index.test.tsx>) — pins that the floor bloom
 * is dark-theme only.
 */
export function heroBlooms(isDark: boolean) {
  return HERO_BLOOMS.filter((bloom) => isDark || !bloom.darkOnly);
}

/**
 * The header-less hero's background off web. The web branch paints two radial gradients over
 * a linear one; React Native has no gradient primitive and `expo-linear-gradient` is not a
 * dependency of this app, so the same depth is layered out of plain views — a stepped settle
 * from the card colour to the page, under concentric translucent accent discs per bloom.
 *
 * @see [index.test.tsx](<../../../tests/app/(user)/index.test.tsx>) — pins that the native hero
 * carries this wash while the web hero keeps its CSS gradient instead.
 */
function HeroWash({
  accent,
  pageColor,
  isDark,
  width,
}: {
  accent: { r: number; g: number; b: number };
  pageColor: string;
  isDark: boolean;
  width: number;
}) {
  const span = width * HERO_BLOOM_SPAN;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID="hero-wash">
      <View style={StyleSheet.absoluteFill}>
        {Array.from({ length: HERO_FADE_STEPS }, (_, step) => (
          <View
            key={step}
            style={[
              styles.heroFadeStep,
              { backgroundColor: pageColor, opacity: (step + 0.5) / HERO_FADE_STEPS },
            ]}
          />
        ))}
      </View>
      {heroBlooms(isDark).map((bloom) => {
        const alpha = bloomRingAlpha(bloom.peak, HERO_BLOOM_RINGS.length);
        return (
          <View key={bloom.key} style={[styles.heroBloom, { left: bloom.left, top: bloom.top }]}>
            {HERO_BLOOM_RINGS.map((ring) => {
              const size = Math.round(span * ring);
              return (
                <View
                  key={ring}
                  style={[
                    styles.heroBloomRing,
                    {
                      width: size,
                      height: size,
                      borderRadius: size / 2,
                      marginLeft: -size / 2,
                      marginTop: -size / 2,
                      backgroundColor: `rgba(${accent.r},${accent.g},${accent.b},${alpha})`,
                    },
                  ]}
                />
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

/**
 * A location card's entrance off web, played once as the list lands rather than on every
 * scroll — web keeps the scroll-driven `CARD_REVEAL` rule in global.css. The whole animation
 * is one native-driven value, so nothing runs per frame in JS.
 *
 * @see [index.test.tsx](<../../../tests/app/(user)/index.test.tsx>) — pins that the cards
 * animate off web and that reduce-motion renders them plain.
 */
function LocationCardReveal({
  index,
  style,
  children,
}: {
  index: number;
  style: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const entrance = Animated.timing(progress, {
      toValue: 1,
      duration: CARD_REVEAL_MS,
      delay: Math.min(index, CARD_REVEAL_MAX_STAGGER) * CARD_REVEAL_STAGGER_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    entrance.start();
    return () => entrance.stop();
  }, [index, progress]);

  return (
    <Animated.View
      testID="location-card-reveal"
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [CARD_REVEAL_RISE, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * The width of one column in a centred, inset, gapped row.
 *
 * A percentage minus a gap share is a `calc()` expression, and React Native has no `calc`:
 * the string reached native untouched above 600dp, which is every tablet and a phone turned
 * sideways. Measuring against the same column the section is capped to gives one answer both
 * platforms can lay out.
 *
 * @see [index.test.tsx](<../../../tests/app/(user)/index.test.tsx>) — pins that a two-column
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
  const [refreshing, setRefreshing] = useState(false);
  /**
   * Bumped by a pull-to-refresh and folded into each card's key: a card asks for today's
   * times once, at mount, so a refreshed list with the same cards still on it would show the
   * availability it had before the pull.
   *
   * @see [index.test.tsx](<../../../tests/app/(user)/index.test.tsx>) — pins that a pull
   * reloads both the list and the cards' availability.
   */
  const [generation, setGeneration] = useState(0);
  const [motionAllowed, setMotionAllowed] = useState(false);
  const [focused, setFocused] = useState(false);
  const { width } = useWindowDimensions();
  const { brand, colors, primaryColor, isDark } = useAppTheme();
  const { t } = useTranslation();
  const scrollRef = useRef<ScrollView>(null);
  const fab = useScrollToTopFab();
  const insets = useSafeAreaInsets();
  const tabBarClearance = useTabBarClearance();

  const isMobile = isMobileWidth(width);

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const load = useCallback(
    () =>
      Promise.all([fetchRestaurants(), fetchHighlights()]).then(
        ([restaurantData, highlightData]) => {
          _cachedRestaurants = restaurantData;
          _cachedHighlights = highlightData;
          setRestaurants(restaurantData);
          setHighlights(highlightData);
          setLoading(false);
        }
      ),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load()
      .then(() => setGeneration((g) => g + 1))
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [load]);

  // The screen stays mounted under whatever is pushed over it, so the status-bar style below
  // has to know whether it is the one on screen rather than merely the one in the tree.
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  useEffect(() => {
    if (Platform.OS === "web") return;
    let listening = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (listening) setMotionAllowed(!reduced);
    });
    return () => {
      listening = false;
    };
  }, []);

  const mutedColor = colors.muted;
  const hasHero = !!brand.headerImageUrl;
  const heroOverlayTextShadow =
    Platform.OS === "web"
      ? ({ textShadow: "0 1px 3px rgba(0,0,0,0.55), 0 2px 14px rgba(0,0,0,0.35)" } as object)
      : styles.heroOverlayTextShadow;

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
  const revealCards = Platform.OS !== "web" && motionAllowed;

  /**
   * Highlights stay one row. Past the column count they scroll sideways instead of
   * wrapping, so a fifth highlight doesn't open a second row with three empty slots in it.
   *
   * @see [index.test.tsx](<../../../tests/app/(user)/index.test.tsx>) — pins the boundary: four
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
      {/*
        The header photo runs under the status bar with a dark wash over it, so the bar's
        icons read only in light — whatever the theme. The root layout's theme-driven bar takes
        back over the moment another screen is on top or the photo is gone.

        @see [index.test.tsx](<../../../tests/app/(user)/index.test.tsx>) — pins that the light
        bar is tied to the photo and to this screen being the one in front.
      */}
      {Platform.OS !== "web" && hasHero && focused && <StatusBar style="light" />}

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarClearance }]}
        showsVerticalScrollIndicator={false}
        onScroll={fab.trackScroll}
        scrollEventThrottle={16}
        refreshControl={
          Platform.OS === "web" ? undefined : (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={hasHero ? "#fff" : primaryColor}
              colors={[primaryColor]}
            />
          )
        }
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
            {!hasHero && Platform.OS !== "web" && (
              <HeroWash
                accent={{ r: accentR, g: accentG, b: accentB }}
                pageColor={colors.page}
                isDark={isDark}
                width={width}
              />
            )}
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
                // This screen draws with no header (`tabRoot()` in GuestTabStack), so
                // nothing above it has reserved the status bar
                // and the hero starts at the top of the display. `paddingTop` alone is a web
                // constant sized for the navbar, and lands a few points short of a notch.
                Platform.OS !== "web" && {
                  paddingTop: insets.top + HERO_SETTINGS_ROW + HERO_TOP_GAP,
                },
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
                      hasHero && heroOverlayTextShadow,
                    ]}
                  >
                    {highlightsHeading}
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.highlightsBy,
                      { color: hasHero ? "rgba(255,255,255,0.82)" : mutedColor },
                      hasHero && heroOverlayTextShadow,
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
                : restaurants.map((r, i) =>
                    revealCards ? (
                      <LocationCardReveal
                        key={`${r.id}:${generation}`}
                        index={i}
                        style={cardWrapperStyle}
                      >
                        <RestaurantCard restaurant={r} party={DEFAULT_PARTY_SIZE} />
                      </LocationCardReveal>
                    ) : (
                      <View
                        key={`${r.id}:${generation}`}
                        style={cardWrapperStyle}
                        {...(CARD_REVEAL as object)}
                      >
                        <RestaurantCard restaurant={r} party={DEFAULT_PARTY_SIZE} />
                      </View>
                    )
                  )}
            </View>
          </View>
        </View>

        <ScrollToTopFab visible={fab.visible} onPress={scrollToTop} />
        <Footer />
      </ScrollView>
    </ThemedView>
  );
}
