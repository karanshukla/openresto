import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { fetchRestaurantById, RestaurantDto } from "@/api/restaurants";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import RestaurantDetails from "@/components/restaurant/RestaurantDetails";
import { Link, useLocalSearchParams } from "expo-router";
import PageContainer from "@/components/layout/PageContainer";
import Button from "@/components/common/Button";

export default function RestaurantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [restaurant, setRestaurant] = useState<RestaurantDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      async function loadRestaurant() {
        const data = await fetchRestaurantById(parseInt(id, 10));
        setRestaurant(data);
        setLoading(false);
      }
      loadRestaurant();
    }
  }, [id]);

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
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
        <Link href={`/book/${id}`} asChild>
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
