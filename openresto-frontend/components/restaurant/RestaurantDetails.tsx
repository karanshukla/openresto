import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { RestaurantDto } from "@/api/restaurants";
import { StyleSheet } from "react-native";

export default function RestaurantDetails({
  restaurant,
}: {
  restaurant: RestaurantDto;
}) {
  return (
    <ThemedView>
      <ThemedText type="title">{restaurant.name}</ThemedText>
      <ThemedText style={styles.address}>{restaurant.address}</ThemedText>
      {restaurant.sections.map((section) => (
        <ThemedView key={section.id} style={styles.section}>
          <ThemedText type="subtitle">{section.name}</ThemedText>
          {section.tables.map((table) => (
            <ThemedView key={table.id} style={styles.table}>
              <ThemedText>Table: {table.name}</ThemedText>
              <ThemedText>Seats: {table.seats}</ThemedText>
            </ThemedView>
          ))}
        </ThemedView>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  address: {
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  table: {
    marginLeft: 16,
    marginBottom: 8,
  },
});
