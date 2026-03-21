import { ThemedText } from "@/components/themed-text";
import { RestaurantDto } from "@/api/restaurants";
import { Link } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { PRIMARY, MUTED_LIGHT, MUTED_DARK } from "@/constants/colors";

export default function RestaurantCard({
  restaurant,
}: {
  restaurant: RestaurantDto;
}) {
  const isDark = useColorScheme() === "dark";
  const mutedColor = isDark ? MUTED_DARK : MUTED_LIGHT;

  const totalTables = restaurant.sections.reduce(
    (acc, s) => acc + s.tables.length,
    0
  );

  return (
    <Link href={`/restaurant/${restaurant.id}`} asChild>
      <Pressable
        style={(state) => [
          styles.card,
          isDark ? styles.cardDark : styles.cardLight,
          (state as any).hovered && styles.cardHovered,
          { cursor: "pointer" } as any,
        ]}
      >
        <View style={[styles.accent, { backgroundColor: PRIMARY }]} />

        <View style={styles.body}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {restaurant.name}
          </ThemedText>

          {restaurant.address ? (
            <ThemedText
              style={[styles.address, { color: mutedColor }]}
              numberOfLines={1}
            >
              {restaurant.address}
            </ThemedText>
          ) : null}

          <View style={styles.footer}>
            <ThemedText style={[styles.meta, { color: mutedColor }]}>
              {restaurant.sections.length}{" "}
              {restaurant.sections.length === 1 ? "section" : "sections"} ·{" "}
              {totalTables} {totalTables === 1 ? "table" : "tables"}
            </ThemedText>
            <ThemedText style={[styles.cta, { color: PRIMARY }]}>
              Reserve →
            </ThemedText>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
  },
  cardLight: {
    backgroundColor: "#fff",
    borderColor: "rgba(0,0,0,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  cardDark: {
    backgroundColor: "#1e2022",
    borderColor: "rgba(255,255,255,0.09)",
  },
  cardHovered: {
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
    transform: [{ translateY: -2 }],
  },
  accent: {
    height: 4,
  },
  body: {
    padding: 20,
    gap: 6,
  },
  name: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  address: {
    fontSize: 14,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  meta: {
    fontSize: 13,
  },
  cta: {
    fontSize: 14,
    fontWeight: "600",
  },
});
