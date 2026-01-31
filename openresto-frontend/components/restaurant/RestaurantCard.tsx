import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { RestaurantDto } from "@/api/restaurants";
import { Link } from "expo-router";
import { Pressable, StyleSheet } from "react-native";

export default function RestaurantCard({
  restaurant,
}: {
  restaurant: RestaurantDto;
}) {
  return (
    <Link href={`/restaurant/${restaurant.id}`} asChild>
      <Pressable>
        <ThemedView style={styles.container}>
          <ThemedText type="subtitle">{restaurant.name}</ThemedText>
          <ThemedText>{restaurant.address}</ThemedText>
        </ThemedView>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
});
