import { ThemedText } from "@/components/themed-text";
import { RestaurantDto } from "@/api/restaurants";
import { Link } from "expo-router";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { PRIMARY, MUTED_LIGHT, MUTED_DARK } from "@/constants/colors";
import { Ionicons } from "@expo/vector-icons";

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
  const totalSeats = restaurant.sections.reduce(
    (acc, s) => acc + s.tables.reduce((a, t) => a + t.seats, 0),
    0
  );

  // Pick a consistent hue offset from the name so cards feel distinct
  const hues = [195, 210, 165, 220, 180, 200];
  const hue = hues[restaurant.name.charCodeAt(0) % hues.length];
  const headerBg = isDark
    ? `hsl(${hue}, 55%, 20%)`
    : `hsl(${hue}, 65%, 86%)`;
  const iconBg = `hsl(${hue}, 65%, ${isDark ? "30%" : "76%"})`;
  const iconColor = `hsl(${hue}, 70%, ${isDark ? "78%" : "28%"})`;
  const initial = restaurant.name.charAt(0).toUpperCase();

  const webShadow =
    Platform.OS === "web"
      ? isDark
        ? ({ boxShadow: "0 4px 24px rgba(0,0,0,0.55)" } as any)
        : ({ boxShadow: "0 4px 20px rgba(0,0,0,0.1)" } as any)
      : {};

  return (
    <Link href={`/(user)/book/${restaurant.id}`} asChild>
      <Pressable
        style={(state) => [
          styles.card,
          isDark ? styles.cardDark : styles.cardLight,
          webShadow,
          (state as any).hovered && (isDark ? styles.cardHoveredDark : styles.cardHoveredLight),
          { cursor: "pointer" } as any,
        ]}
      >
        {/* Coloured header band */}
        <View style={[styles.header, { backgroundColor: headerBg }]}>
          <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
            <Ionicons name="restaurant" size={20} color={iconColor} />
          </View>
          <ThemedText style={[styles.initial, { color: iconColor }]}>
            {initial}
          </ThemedText>
        </View>

        {/* Body */}
        <View style={styles.body}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {restaurant.name}
          </ThemedText>

          {restaurant.address ? (
            <View style={styles.addressRow}>
              <Ionicons
                name="location-outline"
                size={13}
                color={mutedColor}
                style={{ marginTop: 1 }}
              />
              <ThemedText
                style={[styles.address, { color: mutedColor }]}
                numberOfLines={1}
              >
                {restaurant.address}
              </ThemedText>
            </View>
          ) : null}

          {/* Chips */}
          <View style={styles.chips}>
            <View style={[styles.chip, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)" }]}>
              <Ionicons name="grid-outline" size={11} color={mutedColor} />
              <ThemedText style={[styles.chipText, { color: mutedColor }]}>
                {totalTables} {totalTables === 1 ? "table" : "tables"}
              </ThemedText>
            </View>
            <View style={[styles.chip, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)" }]}>
              <Ionicons name="people-outline" size={11} color={mutedColor} />
              <ThemedText style={[styles.chipText, { color: mutedColor }]}>
                {totalSeats} seats
              </ThemedText>
            </View>
          </View>

          {/* CTA */}
          <View style={[styles.ctaBtn, { backgroundColor: PRIMARY }]}>
            <ThemedText style={styles.ctaBtnText}>Book a table</ThemedText>
            <Ionicons name="arrow-forward" size={14} color="#fff" />
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
  },
  cardLight: {
    backgroundColor: "#ffffff",
    borderColor: "rgba(0,0,0,0.1)",
    elevation: 4,
  },
  cardDark: {
    backgroundColor: "#1e2428",
    borderColor: "rgba(255,255,255,0.14)",
  },
  cardHoveredLight: {
    transform: [{ translateY: -3 }],
  },
  cardHoveredDark: {
    transform: [{ translateY: -3 }],
  },
  header: {
    height: 100,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    fontSize: 44,
    fontWeight: "800",
    opacity: 0.18,
    lineHeight: 52,
  },
  body: {
    padding: 18,
    gap: 8,
  },
  name: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
  },
  address: {
    fontSize: 13,
    flex: 1,
  },
  chips: {
    flexDirection: "row",
    gap: 6,
    marginTop: 2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chipText: {
    fontSize: 11,
    fontWeight: "500",
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ctaBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
