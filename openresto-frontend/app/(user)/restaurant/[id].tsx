import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  fetchRestaurantById,
  RestaurantDto,
} from "@/api/restaurants";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";
import RestaurantDetails from "@/components/restaurant/RestaurantDetails";
import { Link, useLocalSearchParams } from "expo-router";

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
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" />
      </ThemedView>
    );
  }

  if (!restaurant) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Restaurant not found.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <RestaurantDetails restaurant={restaurant} />
      <Link href={`/book/${id}`} asChild>
        <Pressable style={styles.button}>
          <ThemedText style={styles.buttonText}>Book a table</ThemedText>
        </Pressable>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  button: {
    backgroundColor: "#007BFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
