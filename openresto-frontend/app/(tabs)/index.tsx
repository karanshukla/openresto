import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  fetchRestaurants,
  RestaurantDto,
} from "@/api/restaurants";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet } from "react-native";
import RestaurantCard from "@/components/restaurant/RestaurantCard";

export default function HomeScreen() {
  const [restaurants, setRestaurants] = useState<RestaurantDto[]>([]);

  useEffect(() => {
    async function loadRestaurants() {
      const data = await fetchRestaurants();
      setRestaurants(data);
    }
    loadRestaurants();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Restaurants</ThemedText>
      <FlatList
        data={restaurants}
        renderItem={({ item }) => <RestaurantCard restaurant={item} />}
        keyExtractor={(item) => item.id.toString()}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
});
