import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { LinkedText } from "@/components/common/LinkedText";
import { RestaurantDto } from "@/api/restaurants";
import { View } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./RestaurantDetails.styles";

export default function RestaurantDetails({ restaurant }: { restaurant: RestaurantDto }) {
  const { colors, isDark } = useAppTheme();
  const mutedColor = colors.muted;
  const borderColor = colors.border;
  const chipBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";

  return (
    <View style={styles.container}>
      <ThemedText type="title" style={styles.name}>
        {restaurant.name}
      </ThemedText>

      {restaurant.address ? (
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={16} color={mutedColor} />
          <ThemedText style={[styles.address, { color: mutedColor }]}>
            {restaurant.address}
          </ThemedText>
        </View>
      ) : null}

      {restaurant.description ? (
        <LinkedText text={restaurant.description} style={styles.description} />
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
