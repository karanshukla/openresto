import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { fetchRestaurants, RestaurantDto } from "@/api/restaurants";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import RestaurantCard from "@/components/restaurant/RestaurantCard";
import PageContainer from "@/components/layout/PageContainer";
import Navbar from "@/components/layout/Navbar";
import { COLORS, getThemeColors } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function HomeScreen() {
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const brand = useBrand();

  useEffect(() => {
    async function loadRestaurants() {
      const data = await fetchRestaurants();
      setRestaurants(data);
      setLoading(false);
    }
    loadRestaurants();
  }, []);

  const numColumns = width >= 1024 ? 3 : width >= 640 ? 2 : 1;
  const cardWidth: string | number =
    numColumns === 1
      ? "100%"
      : Math.floor(
          (Math.min(width, 1200) - 48 - (numColumns > 1 ? 20 : 16) * (numColumns - 1)) / numColumns
        );

  return (
    <ThemedView style={{ flex: 1 }}>
      <Navbar />
      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.page }]}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero */}
        <View
          style={[
            styles.hero,
            Platform.OS === "web"
              ? ({
                  background: "linear-gradient(135deg, #0a7ea4 0%, #085f7a 60%, #065168 100%)",
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any)
              : { backgroundColor: COLORS.primary },
          ]}
        >
          <View style={styles.heroOverlay}>
            <View style={styles.heroContent}>
              <ThemedText style={styles.heroEyebrow}>Reserve online, instantly</ThemedText>
              <ThemedText style={styles.heroTitle}>{brand.appName}</ThemedText>
              <ThemedText style={styles.heroSubtitle}>
                Browse available restaurants and book a table in seconds.
              </ThemedText>
            </View>
          </View>
        </View>

        <PageContainer>
          <ThemedText style={styles.sectionLabel}>
            {loading
              ? "Loading…"
              : `${restaurants.length} restaurant${restaurants.length !== 1 ? "s" : ""}`}
          </ThemedText>

          {loading ? (
            <ActivityIndicator size="large" style={styles.spinner} color={COLORS.primary} />
          ) : (
            <View style={[styles.grid, { gap: numColumns > 1 ? 20 : 16 }]}>
              {restaurants.map((r) => (
                <View
                  key={r.id}
                  style={[
                    styles.cardWrapper,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    { width: cardWidth as any },
                  ]}
                >
                  <RestaurantCard restaurant={r} />
                </View>
              ))}
            </View>
          )}
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    width: "100%",
    minHeight: 300,
  },
  heroOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.18)",
    paddingVertical: 72,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  heroContent: {
    maxWidth: 640,
    width: "100%",
    alignItems: "flex-start",
  },
  heroEyebrow: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 52,
    fontWeight: "800",
    lineHeight: 56,
    color: "#fff",
    letterSpacing: -1.5,
    marginBottom: 16,
  },
  heroSubtitle: {
    fontSize: 18,
    color: "rgba(255,255,255,0.82)",
    lineHeight: 28,
  },
  sectionLabel: {
    marginBottom: 20,
    marginTop: 32,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#6b7280",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cardWrapper: {
    marginBottom: 20,
  },
  spinner: {
    marginTop: 60,
  },
});
