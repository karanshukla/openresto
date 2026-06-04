import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { fetchRestaurants, fetchHighlights, RestaurantDto, HighlightDto } from "@/api/restaurants";
import { useEffect, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Stack } from "expo-router";
import Navbar from "@/components/layout/Navbar";
import RestaurantCard from "@/components/restaurant/RestaurantCard";
import { useAppTheme } from "@/hooks/use-app-theme";
import { Ionicons } from "@expo/vector-icons";

export default function HomeScreen() {
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [highlights, setHighlights] = useState<HighlightDto[]>([]);
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();
  const { brand, colors, primaryColor, isDark } = useAppTheme();

  const isMobile = width < 700;
  const party = 2;

  useEffect(() => {
    Promise.all([fetchRestaurants(), fetchHighlights()]).then(([restaurantData, highlightData]) => {
      setRestaurants(restaurantData);
      setHighlights(highlightData);
      setLoading(false);
    });
  }, []);

  const bg = isDark ? "#0c0d10" : "#f7f4ed";
  const surface = isDark ? "#14161a" : "#ffffff";
  const border = isDark ? "#25282f" : "#e2dbcb";
  const mutedColor = colors.muted;
  const hasHero = !!brand.headerImageUrl && Platform.OS === "web";
  const heroTextShadow = "0 1px 3px rgba(0,0,0,0.55), 0 2px 14px rgba(0,0,0,0.35)";

  const accentHex = primaryColor.replace("#", "");
  const accentR = parseInt(accentHex.slice(0, 2), 16);
  const accentG = parseInt(accentHex.slice(2, 4), 16);
  const accentB = parseInt(accentHex.slice(4, 6), 16);
  const accentSoft = `rgba(${accentR},${accentG},${accentB},0.18)`;

  const numColumns = width < 600 ? 1 : width < 1000 ? 2 : 3;
  const numHighlightCols = width < 600 ? 1 : width < 900 ? 2 : 4;

  return (
    <ThemedView style={[styles.root, { backgroundColor: bg }]}>
      {Platform.OS !== "web" && <Stack.Screen options={{ title: brand.appName }} />}
      <Navbar />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View
          style={[
            styles.hero,
            {
              backgroundColor: surface,
              borderBottomColor: border,
              ...(Platform.OS === "web" &&
                (hasHero
                  ? ({
                      backgroundImage: `url(${brand.headerImageUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    } as object)
                  : ({
                      background: isDark
                        ? `radial-gradient(80% 90% at 90% 10%, ${accentSoft}, transparent 60%), radial-gradient(60% 80% at 10% 100%, rgba(${accentR},${accentG},${accentB},0.12), transparent 60%), linear-gradient(180deg, ${surface} 0%, ${bg} 100%)`
                        : `radial-gradient(80% 90% at 90% 10%, ${accentSoft}, transparent 60%), linear-gradient(180deg, ${surface} 0%, ${bg} 100%)`,
                    } as object))),
            },
          ]}
        >
          {hasHero && (
            <View
              style={[
                { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
                {
                  background: `linear-gradient(160deg, rgba(${accentR},${accentG},${accentB},0.30) 0%, rgba(0,0,0,0.40) 100%)`,
                } as object,
              ]}
              pointerEvents="none"
            />
          )}
          <View style={[styles.heroInner, isMobile && { paddingHorizontal: 20 }]}>
            <ThemedText
              style={[
                styles.heroTitle,
                isMobile && { fontSize: 40, lineHeight: 44 },
                hasHero && ({ color: "#ffffff", textShadow: heroTextShadow } as object),
              ]}
            >
              {brand.appName}
            </ThemedText>
            <ThemedText
              style={[
                styles.heroSub,
                { color: hasHero ? "rgba(255,255,255,0.82)" : mutedColor },
                hasHero && ({ textShadow: heroTextShadow } as object),
              ]}
            >
              Scroll down to pick a location below, choose a time, enter your email address, and
              you're booked!
            </ThemedText>
          </View>

          {/* ── Highlights ── */}
          <View style={[styles.highlights, isMobile && { paddingHorizontal: 20 }]}>
            <View style={styles.highlightsHead}>
              <ThemedText
                style={[
                  styles.highlightsLabel,
                  { color: hasHero ? "rgba(255,255,255,0.75)" : mutedColor },
                ]}
              >
                Restaurant highlights
              </ThemedText>
              <ThemedText
                style={[
                  styles.highlightsBy,
                  { color: hasHero ? "rgba(255,255,255,0.65)" : mutedColor },
                ]}
              >
                Curated by the owner
              </ThemedText>
            </View>
            <View
              style={[
                styles.highlightsGrid,
                numHighlightCols > 1 && { flexDirection: "row", flexWrap: "wrap" },
              ]}
            >
              {highlights.map((h) => (
                <View
                  key={h.id}
                  style={[
                    styles.highlightCard,
                    { backgroundColor: surface, borderColor: border },
                    numHighlightCols > 1 && {
                      width:
                        numHighlightCols === 2
                          ? ("calc(50% - 6px)" as unknown as number)
                          : ("calc(25% - 9px)" as unknown as number),
                      minWidth: 200,
                    },
                  ]}
                >
                  <View style={styles.highlightHeader}>
                    <View
                      style={[
                        styles.highlightIconBox,
                        { backgroundColor: `rgba(${accentR},${accentG},${accentB},0.18)` },
                      ]}
                    >
                      <Ionicons
                        name={h.iconKey as ComponentProps<typeof Ionicons>["name"]}
                        size={16}
                        color={primaryColor}
                      />
                    </View>
                    <ThemedText style={styles.highlightTitle}>{h.title}</ThemedText>
                  </View>
                  <ThemedText style={[styles.highlightBody, { color: mutedColor }]}>
                    {h.body}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Main body ── */}
        <View style={[styles.body, isMobile && { paddingHorizontal: 16 }]}>
          <View style={styles.sectionHead}>
            <ThemedText style={styles.sectionTitle}>Our locations</ThemedText>
          </View>

          {loading ? (
            <ActivityIndicator
              testID="loading-screen"
              style={styles.spinner}
              size="large"
              color={primaryColor}
            />
          ) : (
            <View
              style={[styles.grid, numColumns > 1 && { flexDirection: "row", flexWrap: "wrap" }]}
            >
              {restaurants.map((r, i) => (
                <View
                  key={r.id}
                  style={[
                    styles.cardWrapper,
                    numColumns > 1 && {
                      width:
                        numColumns === 2
                          ? ("calc(50% - 9px)" as unknown as number)
                          : ("calc(33.333% - 12px)" as unknown as number),
                      minWidth: 320,
                    },
                  ]}
                >
                  <RestaurantCard restaurant={r} index={i} party={party} />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  // Hero
  hero: {
    borderBottomWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  heroInner: {
    maxWidth: 1320,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 56,
    paddingBottom: 28,
    position: "relative",
  },
  heroTitle: {
    fontSize: 64,
    fontWeight: "700",
    lineHeight: 68,
    letterSpacing: -1.5,
    marginBottom: 14,
    maxWidth: 820,
  },
  heroSub: {
    fontSize: 17,
    lineHeight: 26,
    maxWidth: 500,
  },

  // Highlights
  highlights: {
    maxWidth: 1320,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 40,
  },
  highlightsHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  highlightsLabel: {
    fontSize: 13,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  highlightsBy: {
    fontSize: 12,
  },
  highlightsGrid: {
    gap: 12,
  },
  highlightCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    width: "100%",
  },
  highlightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  highlightIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  highlightTitle: {
    fontSize: 14.5,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  highlightBody: {
    fontSize: 13,
    lineHeight: 19,
  },

  // Body
  body: {
    maxWidth: 1320,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 60,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  grid: {
    gap: 18,
  },
  cardWrapper: {
    width: "100%",
  },
  spinner: {
    marginTop: 60,
  },

  // Footer
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 28,
    paddingVertical: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    maxWidth: 1320,
    width: "100%",
    alignSelf: "center",
  },
  footerText: {
    fontSize: 13,
  },
  footerLinks: {
    flexDirection: "row",
    gap: 18,
  },
  footerLink: {
    fontSize: 13,
  },
});
