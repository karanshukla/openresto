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
import { Stack } from "expo-router";
import Navbar from "@/components/layout/Navbar";
import PageContainer from "@/components/layout/PageContainer";
import RestaurantCard from "@/components/restaurant/RestaurantCard";
import { useAppTheme } from "@/hooks/use-app-theme";

export default function HomeScreen() {
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);
  const [loading, setLoading] = useState(true);
  const { width } = useWindowDimensions();
  const { brand, colors, primaryColor } = useAppTheme();

  useEffect(() => {
    fetchRestaurants().then((data) => {
      setRestaurants(data);
      setLoading(false);
    });
  }, []);

  const numColumns = width < 600 ? 1 : width < 900 ? 2 : 3;
  const gap = numColumns > 1 ? 20 : 16;
  const cardWidth =
    numColumns === 1
      ? "100%"
      : width > 0
        ? `${(100 - (gap * (numColumns - 1)) / (Math.min(width, 1200) / 100)) / numColumns}%`
        : "30%";

  return (
    <ThemedView style={{ flex: 1 }}>
      {Platform.OS !== "web" && <Stack.Screen options={{ title: brand.appName }} />}
      <Navbar />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={StyleSheet.flatten([styles.hero, { backgroundColor: primaryColor }])}>
          <View style={styles.heroOverlay}>
            <View style={styles.heroContent}>
              <ThemedText style={styles.heroEyebrow}>Reserve online, instantly</ThemedText>
              <ThemedText style={styles.heroTitle} numberOfLines={2}>
                {brand.appName}
              </ThemedText>
              <ThemedText style={styles.heroSubtitle}>
                Browse available restaurants and book a table in seconds.
              </ThemedText>
            </View>
          </View>
        </View>

        <PageContainer>
          <ThemedText style={StyleSheet.flatten([styles.sectionLabel, { color: colors.muted }])}>
            {`${restaurants.length} restaurant${restaurants.length !== 1 ? "s" : ""}`}
          </ThemedText>

          {loading ? (
            <ActivityIndicator style={styles.spinner} size="large" color={primaryColor} />
          ) : (
            <View style={styles.grid}>
              {restaurants.map((r) => (
                <View
                  key={r.id}
                  style={StyleSheet.flatten([
                    styles.cardWrapper,
                    { width: cardWidth as any, minWidth: numColumns === 1 ? "100%" : 280 },
                  ])}
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
    paddingBottom: 40,
  },
  hero: {
    height: 320,
    width: "100%",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.15)",
    justifyContent: "center",
  },
  heroContent: {
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 24,
  },
  heroEyebrow: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 12,
    opacity: 0.9,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -1,
    lineHeight: 52,
    marginBottom: 16,
  },
  heroSubtitle: {
    color: "#fff",
    fontSize: 18,
    opacity: 0.9,
    maxWidth: 500,
    lineHeight: 26,
  },
  sectionLabel: {
    fontSize: 12,
    marginBottom: 20,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  cardWrapper: {
    marginBottom: 20,
  },
  spinner: {
    marginTop: 60,
  },
});
