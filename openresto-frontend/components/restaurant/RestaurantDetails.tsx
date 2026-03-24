import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { RestaurantDto } from "@/api/restaurants";
import { StyleSheet, View } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function RestaurantDetails({ restaurant }: { restaurant: RestaurantDto }) {
  const isDark = useColorScheme() === "dark";
  const mutedColor = isDark ? "#9ca3af" : "#6b7280";
  const borderColor = isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.08)";
  const chipBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";

  return (
    <View style={styles.container}>
      <ThemedText type="title" style={styles.name}>
        {restaurant.name}
      </ThemedText>

      {restaurant.address ? (
        <ThemedText style={[styles.address, { color: mutedColor }]}>
          📍 {restaurant.address}
        </ThemedText>
      ) : null}

      <View style={[styles.divider, { backgroundColor: borderColor }]} />

      <ThemedText type="defaultSemiBold" style={styles.sectionHeading}>
        Seating
      </ThemedText>

      {restaurant.sections.map((section) => (
        <ThemedView key={section.id} style={[styles.sectionCard, { borderColor }]}>
          <ThemedText style={styles.sectionName}>{section.name}</ThemedText>

          <View style={styles.tableGrid}>
            {section.tables.map((table) => (
              <View
                key={table.id}
                style={[styles.tableChip, { backgroundColor: chipBg, borderColor }]}
              >
                <ThemedText style={styles.tableName}>
                  {table.name ?? `Table ${table.id}`}
                </ThemedText>
                <ThemedText style={[styles.tableSeats, { color: mutedColor }]}>
                  {table.seats} seats
                </ThemedText>
              </View>
            ))}
          </View>
        </ThemedView>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  name: {
    marginBottom: 4,
  },
  address: {
    fontSize: 15,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
  sectionHeading: {
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    gap: 12,
  },
  sectionName: {
    fontSize: 16,
    fontWeight: "600",
  },
  tableGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tableChip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "center",
    gap: 2,
  },
  tableName: {
    fontSize: 14,
    fontWeight: "500",
  },
  tableSeats: {
    fontSize: 12,
  },
});
