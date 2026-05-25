import { ThemedText } from "@/components/themed-text";
import { RestaurantDto } from "@/api/restaurants";
import { useRouter } from "expo-router";
import { Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getThemeColors, COLORS } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";
import { Ionicons } from "@expo/vector-icons";

// Predefined gradient pairs for the card image area (brand-agnostic)
const CARD_GRADIENTS = [
  ["#7a2e0e", "#c97542"],
  ["#1e3a3a", "#7c9982"],
  ["#3d2818", "#b87840"],
  ["#1a1e3a", "#5b6fbe"],
  ["#1a3a2a", "#3faa70"],
];

function generateSlots(openTime: string, closeTime: string, id: number) {
  const [openH, openM] = openTime.split(":").map(Number);
  const [closeH] = closeTime.split(":").map(Number);
  const startH = Math.max(isNaN(openH) ? 18 : openH, 17);
  const slots: { t: string; avail: boolean }[] = [];
  let h = startH,
    m = isNaN(openM) ? 0 : openM;
  while (slots.length < 5 && h < Math.min(closeH, 23)) {
    const label = `${h}:${m === 0 ? "00" : m}`;
    const avail = (h + Math.floor(m / 30) + id) % 4 !== 0;
    slots.push({ t: label, avail });
    m += 30;
    if (m >= 60) {
      m -= 60;
      h++;
    }
  }
  return slots;
}

function getRestaurantNow(timezone: string): { totalMins: number; isoDay: number } {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      weekday: "long",
      hour12: false,
    }).formatToParts(now);
    const rawHour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24;
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Monday";
    const dayMap: Record<string, number> = {
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
      Sunday: 7,
    };
    return { totalMins: rawHour * 60 + minute, isoDay: dayMap[weekday] ?? 1 };
  } catch {
    const now = new Date();
    const jsDay = now.getDay();
    return {
      totalMins: now.getHours() * 60 + now.getMinutes(),
      isoDay: jsDay === 0 ? 7 : jsDay,
    };
  }
}

function isOpenNow(
  openTime: string,
  closeTime: string,
  timezone: string,
  openDays: string
): boolean {
  const [oh, om] = openTime.split(":").map(Number);
  const [ch, cm] = closeTime.split(":").map(Number);
  if (isNaN(oh) || isNaN(ch)) return true;
  const { totalMins, isoDay } = getRestaurantNow(timezone || "UTC");
  const openDaysList = openDays?.split(",").map(Number) ?? [1, 2, 3, 4, 5, 6, 7];
  if (!openDaysList.includes(isoDay)) return false;
  return totalMins >= oh * 60 + om && totalMins < ch * 60 + cm;
}

export default function RestaurantCard({
  restaurant,
  index = 0,
  party = 2,
}: {
  restaurant: RestaurantDto;
  index?: number;
  party?: number;
}) {
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const mutedColor = colors.muted;
  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;
  const router = useRouter();

  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const open = isOpenNow(
    restaurant.openTime,
    restaurant.closeTime,
    restaurant.timezone ?? "UTC",
    restaurant.openDays
  );
  const slots = generateSlots(restaurant.openTime, restaurant.closeTime, restaurant.id);
  const tags = restaurant.tags ?? [];

  const accentHex = primaryColor.replace("#", "");
  const accentR = parseInt(accentHex.slice(0, 2), 16);
  const accentG = parseInt(accentHex.slice(2, 4), 16);
  const accentB = parseInt(accentHex.slice(4, 6), 16);
  const accentSoft = `rgba(${accentR},${accentG},${accentB},0.12)`;
  const accentBorder = `rgba(${accentR},${accentG},${accentB},0.3)`;

  const cardBg = colors.card;
  const borderColor = colors.border;
  const surface2 = isDark ? "#1b1e23" : "#f3efe6";

  const cardShadow =
    Platform.OS === "web"
      ? isDark
        ? ({ boxShadow: "0 8px 24px -12px rgba(0,0,0,0.6)" } as object)
        : ({ boxShadow: "0 8px 24px -16px rgba(60,40,10,0.18)" } as object)
      : ({
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 4,
        } as object);

  return (
    <Pressable
      onPress={() => router.push(`/(user)/book?restaurantId=${restaurant.id}`)}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        styles.card,
        cardShadow,
        { backgroundColor: cardBg, borderColor },
        (hovered || pressed) &&
          Platform.OS === "web" && {
            transform: [{ translateY: -2 }],
            borderColor: isDark ? "#383d47" : "#cfc6b1",
          },
      ]}
    >
      {/* Image area */}
      <View
        style={[
          styles.imageArea,
          Platform.OS === "web" &&
            (restaurant.imageUrl
              ? ({
                  backgroundImage: `url(${restaurant.imageUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                } as object)
              : ({
                  background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
                } as object)),
          Platform.OS !== "web" && { backgroundColor: gradient[0] },
        ]}
      >
        {/* Dot pattern overlay - only when no custom image */}
        {Platform.OS === "web" && !restaurant.imageUrl && (
          <View
            style={[
              StyleSheet.absoluteFillObject,
              {
                opacity: 0.5,
              } as object,
            ]}
          />
        )}

        {/* Top row: status badge */}
        <View style={styles.imageTopRow}>
          <View
            style={[
              styles.badge,
              open
                ? { backgroundColor: `rgba(${accentR},${accentG},${accentB},0.88)` }
                : styles.badgeClosed,
            ]}
          >
            <View style={styles.badgeDot} />
            <ThemedText style={styles.badgeText}>
              {open ? `Open till ${restaurant.closeTime}` : "Closed"}
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Card body */}
      <View style={styles.body}>
        {/* Name row */}
        <View style={styles.nameRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ThemedText style={styles.name} numberOfLines={1}>
              {restaurant.name}
            </ThemedText>
            <View style={styles.meta}>
              <Ionicons name="location-outline" size={11} color={mutedColor} />
              <ThemedText style={[styles.metaText, { color: mutedColor }]} numberOfLines={1}>
                {restaurant.address || "Multiple areas"}
              </ThemedText>
              <View style={styles.mapLinks}>
                <Pressable
                  style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                    styles.mapLink,
                    {
                      backgroundColor: surface2,
                      borderColor: hovered || pressed ? primaryColor : borderColor,
                    },
                  ]}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    Linking.openURL(
                      `https://maps.google.com/?q=${encodeURIComponent(restaurant.address || "")}`
                    );
                  }}
                  accessibilityLabel="Open in Google Maps"
                >
                  <Ionicons name="navigate-outline" size={11} color={mutedColor} />
                  <ThemedText style={[styles.mapLinkText, { color: mutedColor }]}>
                    Google
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                    styles.mapLink,
                    {
                      backgroundColor: surface2,
                      borderColor: hovered || pressed ? primaryColor : borderColor,
                    },
                  ]}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    Linking.openURL(
                      `https://maps.apple.com/?q=${encodeURIComponent(restaurant.address || "")}`
                    );
                  }}
                  accessibilityLabel="Open in Apple Maps"
                >
                  <Ionicons name="navigate-outline" size={11} color={mutedColor} />
                  <ThemedText style={[styles.mapLinkText, { color: mutedColor }]}>Apple</ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
          <Pressable
            style={[styles.iconBtn, { backgroundColor: surface2, borderColor }]}
            onPress={(e) => {
              e.stopPropagation?.();
              if (Platform.OS === "web") {
                window.open(`/(user)/book?restaurantId=${restaurant.id}`, "_blank");
              } else {
                router.push(`/(user)/book?restaurantId=${restaurant.id}`);
              }
            }}
            accessibilityLabel="Open booking page in new tab"
          >
            <Ionicons name="open-outline" size={14} color={mutedColor} />
          </Pressable>
        </View>

        {/* Tags */}
        {tags.length > 0 && (
          <View style={styles.tags}>
            {tags.map((t) => (
              <View
                key={t}
                style={[styles.tag, { backgroundColor: accentSoft, borderColor: accentBorder }]}
              >
                <ThemedText style={[styles.tagText, { color: primaryColor }]}>{t}</ThemedText>
              </View>
            ))}
          </View>
        )}

        {/* Time slots */}
        <View>
          <View style={styles.slotLabel}>
            <ThemedText style={[styles.slotLabelText, { color: mutedColor }]}>
              Available slots
            </ThemedText>
            <ThemedText style={[styles.slotLabelWhen, { color: colors.text }]}>
              {party} {party === 1 ? "guest" : "guests"} · tonight
            </ThemedText>
          </View>
          <View style={styles.slotRow}>
            {slots.map((s) => (
              <Pressable
                key={s.t}
                disabled={!s.avail}
                onPress={(e) => {
                  e.stopPropagation?.();
                  router.push(
                    `/(user)/book?restaurantId=${restaurant.id}&time=${encodeURIComponent(s.t)}&party=${party}`
                  );
                }}
                style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                  styles.slot,
                  {
                    backgroundColor: !s.avail
                      ? "transparent"
                      : hovered || pressed
                        ? primaryColor
                        : surface2,
                    borderColor: !s.avail
                      ? borderColor
                      : hovered || pressed
                        ? primaryColor
                        : borderColor,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.slotText,
                    !s.avail && {
                      color: mutedColor,
                      opacity: 0.5,
                      textDecorationLine: "line-through",
                    },
                  ]}
                >
                  {s.t}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={[styles.cardFoot, { borderTopColor: borderColor }]}>
          <View style={styles.hoursRow}>
            <Ionicons name="time-outline" size={12} color={mutedColor} style={{ marginRight: 5 }} />
            <ThemedText style={[styles.hoursText, { color: mutedColor }]}>Open </ThemedText>
            <ThemedText style={[styles.hoursTime, { color: colors.text }]}>
              {restaurant.openTime} – {restaurant.closeTime}
            </ThemedText>
          </View>
          <Pressable
            style={({ pressed }) => [styles.viewBtn, pressed && { backgroundColor: surface2 }]}
            onPress={() => router.push(`/(user)/book?restaurantId=${restaurant.id}`)}
          >
            <ThemedText style={[styles.viewBtnText, { color: primaryColor }]}>
              See details
            </ThemedText>
            <Ionicons name="arrow-forward" size={13} color={primaryColor} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "column",
  },

  // Image area
  imageArea: {
    aspectRatio: 16 / 9,
    position: "relative",
    overflow: "hidden",
  },
  imageTopRow: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 1,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  badgeClosed: {
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  badgeText: {
    color: "#fff",
    fontSize: 11.5,
    fontWeight: "500",
  },
  // Body
  body: {
    padding: 16,
    gap: 12,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  metaText: {
    fontSize: 12.5,
  },
  metaSep: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.6,
  },
  mapLinks: {
    flexDirection: "row",
    gap: 6,
    marginLeft: 2,
    flexWrap: "wrap",
  },
  mapLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  mapLinkText: {
    fontSize: 11.5,
    fontWeight: "500",
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  // Tags
  tags: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 11.5,
  },

  // Slots
  slotLabel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  slotLabelText: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "600",
  },
  slotLabelWhen: {
    fontSize: 12,
    fontWeight: "500",
  },
  slotRow: {
    flexDirection: "row",
    gap: 5,
  },
  slot: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  slotText: {
    fontSize: 12.5,
    fontWeight: "500",
    textAlign: "center",
  },

  // Footer
  cardFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
  hoursRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  hoursText: {
    fontSize: 13,
  },
  hoursTime: {
    fontSize: 13,
    fontWeight: "500",
  },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
  },
  viewBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
