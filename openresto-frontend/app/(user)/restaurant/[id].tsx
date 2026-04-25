import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { fetchRestaurantById, RestaurantDto } from "@/api/restaurants";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import RestaurantDetails from "@/components/restaurant/RestaurantDetails";
import { Link, useLocalSearchParams } from "expo-router";
import PageContainer from "@/components/layout/PageContainer";
import Button from "@/components/common/Button";
import LoadingScreen from "@/components/common/LoadingScreen";

export default function RestaurantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [restaurant, setRestaurant] = useState<RestaurantDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLoading(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (id) {
      let cancelled = false;
      async function loadRestaurant() {
        try {
          const data = await fetchRestaurantById(parseInt(id, 10));
          if (!cancelled) {
            setRestaurant(data);
          }
        } catch (error) {
          console.error("Failed to load restaurant:", error);
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      }
      loadRestaurant();
      return () => {
        cancelled = true;
      };
    } else {
      setLoading(false);
    }
  }, [id]);

  if (loading) {
    if (!showLoading) {
      return <ThemedView style={styles.root} />;
    }
    return <LoadingScreen />;
  }

  if (!restaurant) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>Restaurant not found.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.root}>
      <ScrollView style={styles.scroll}>
        <PageContainer style={styles.page}>
          <RestaurantDetails restaurant={restaurant} />
          <Link href={`/(user)/book?restaurantId=${id}`} asChild>
            <Button style={styles.bookButton}>Book a Table</Button>
          </Link>
        </PageContainer>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  page: {
    maxWidth: 720,
    gap: 16,
  },
  bookButton: {
    marginTop: 8,
  },
});
