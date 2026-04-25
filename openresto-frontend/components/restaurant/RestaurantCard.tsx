import { ThemedText } from "@/components/themed-text";
import { RestaurantDto } from "@/api/restaurants";
import { Link } from "expo-router";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { COLORS, getThemeColors } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";

import { Ionicons } from "@expo/vector-icons";

export default function RestaurantCard({ restaurant }: { restaurant: RestaurantDto }) {
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const mutedColor = colors.muted;
  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;

  const totalTables = restaurant.sections.reduce((acc, s) => acc + s.tables.length, 0);
  const totalSeats = restaurant.sections.reduce(
    (acc, s) => acc + s.tables.reduce((a, t) => a + t.seats, 0),
    0
  );

  const headerBg = isDark ? `${primaryColor}33` : `${primaryColor}15`;
  const iconBg = isDark ? `${primaryColor}44` : `${primaryColor}22`;
  const iconColor = primaryColor;
  const initial = restaurant.name.charAt(0).toUpperCase();

  const cardBg = colors.card;
  const borderColor = colors.border;

  // Outer wrapper has the shadow; inner view has overflow:hidden for the header clip
  const outerShadow =
    Platform.OS === "web"
      ? isDark
        ? ({ boxShadow: "0 4px 24px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.14)" } as const)
        : ({ boxShadow: "0 4px 24px rgba(0,0,0,0.13), 0 0 0 1px rgba(0,0,0,0.12)" } as const)
      : {};

  // Heuristic for tags
  const isPopular = totalSeats > 20;
  const isNew = restaurant.id > 10;

  return (
    <Link href={`/(user)/book?restaurantId=${restaurant.id}`} asChild>
      <Pressable
        style={(state) => [
          styles.outer,
          outerShadow,
          { backgroundColor: cardBg },
          (state as { hovered?: boolean }).hovered && styles.outerHovered,
        ]}
      >
        {/* Inner view clips header to card border radius */}
        <View style={[styles.inner, { borderColor }]}>
          {/* Coloured header band */}
          <View style={[styles.header, { backgroundColor: headerBg }]}>
            <View style={styles.headerTop}>
              <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
                <Ionicons name="restaurant" size={20} color={iconColor} />
              </View>
              <View style={styles.tags}>
                {isPopular && (
                  <View style={[styles.tag, { backgroundColor: COLORS.warning }]}>
                    <ThemedText style={styles.tagText}>Popular</ThemedText>
                  </View>
                )}
                {isNew && (
                  <View style={[styles.tag, { backgroundColor: COLORS.success }]}>
                    <ThemedText style={styles.tagText}>New</ThemedText>
                  </View>
                )}
              </View>
            </View>
            <ThemedText style={[styles.initial, { color: iconColor }]}>{initial}</ThemedText>
          </View>

          {/* Body */}
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <ThemedText style={styles.name} numberOfLines={1}>
                {restaurant.name}
              </ThemedText>
            </View>

            {restaurant.address ? (
              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={13} color={mutedColor} />
                <ThemedText style={[styles.address, { color: mutedColor }]} numberOfLines={1}>
                  {restaurant.address}
                </ThemedText>
              </View>
            ) : null}

            <View style={styles.footer}>
              {/* Chips */}
              <View style={styles.chips}>
                <View style={styles.metaItem}>
                  <Ionicons name="grid-outline" size={12} color={mutedColor} />
                  <ThemedText style={[styles.metaText, { color: mutedColor }]}>
                    {totalTables} {totalTables === 1 ? "table" : "tables"}
                  </ThemedText>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="people-outline" size={12} color={mutedColor} />
                  <ThemedText style={[styles.metaText, { color: mutedColor }]}>
                    {totalSeats} seats
                  </ThemedText>
                </View>
              </View>

              <View style={[styles.ctaCircle, { backgroundColor: primaryColor }]}>
                <Ionicons name="chevron-forward" size={18} color="#fff" />
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  // Outer pressable: has shadow, no overflow:hidden
  outer: {
    borderRadius: 20,
    elevation: 4,
  },
  outerHovered: {
    transform: [{ translateY: -4 }],
  },
  // Inner view: clips header to border radius
  inner: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
  },
  header: {
    height: 110,
    paddingHorizontal: 20,
    paddingVertical: 16,
    justifyContent: "space-between",
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  tags: {
    flexDirection: "row",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    fontSize: 52,
    fontWeight: "900",
    opacity: 0.15,
    position: "absolute",
    right: 15,
    bottom: -5,
  },
  body: {
    padding: 20,
    gap: 6,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  address: {
    fontSize: 13,
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  chips: {
    flexDirection: "row",
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    fontWeight: "600",
  },
  ctaCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
});
