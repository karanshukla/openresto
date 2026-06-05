import { ThemedText } from "@/components/themed-text";
import { RestaurantDto } from "@/api/restaurants";
import { useRouter } from "expo-router";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getThemeColors, COLORS } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { fetchAvailability, TimeSlotDto } from "@/api/availability";

function getRestaurantDate(timezone: string): string {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const year = parts.find((p) => p.type === "year")?.value ?? "";
    const month = parts.find((p) => p.type === "month")?.value ?? "";
    const day = parts.find((p) => p.type === "day")?.value ?? "";
    return `${year}-${month}-${day}`;
  } catch {
    return new Date().toISOString().split("T")[0];
  }
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

function parseDayOfWeek(day: string): number {
  const num = parseInt(day, 10);
  if (!isNaN(num) && num >= 1 && num <= 7) return num;

  const lower = day.toLowerCase();
  if (lower.startsWith("mon")) return 1;
  if (lower.startsWith("tue")) return 2;
  if (lower.startsWith("wed")) return 3;
  if (lower.startsWith("thu")) return 4;
  if (lower.startsWith("fri")) return 5;
  if (lower.startsWith("sat")) return 6;
  if (lower.startsWith("sun")) return 7;
  return 0;
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
  const openDaysList = openDays
    ?.split(",")
    .map((d) => parseDayOfWeek(d.trim()))
    .filter((d) => d > 0) ?? [1, 2, 3, 4, 5, 6, 7];
  if (openDaysList.length > 0 && !openDaysList.includes(isoDay)) return false;
  return totalMins >= oh * 60 + om && totalMins < ch * 60 + cm;
}

export default function RestaurantCard({
  restaurant,
  party = 2,
}: {
  restaurant: RestaurantDto;
  index?: number; // kept for API compatibility
  party?: number;
}) {
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const mutedColor = colors.muted;
  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;
  const router = useRouter();

  const [slots, setSlots] = useState<TimeSlotDto[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);

  useEffect(() => {
    const tz = restaurant.timezone ?? "UTC";
    const { totalMins, isoDay } = getRestaurantNow(tz);
    const openDaysList = restaurant.openDays
      ?.split(",")
      .map((d) => parseDayOfWeek(d.trim()))
      .filter((d) => d > 0) ?? [1, 2, 3, 4, 5, 6, 7];
    if (openDaysList.length > 0 && !openDaysList.includes(isoDay)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSlots([]);

      setSlotsLoading(false);
      return;
    }
    const date = getRestaurantDate(tz);
    fetchAvailability(restaurant.id, date, party).then((data) => {
      if (data && Array.isArray(data.slots)) {
        const future = data.slots.filter((s) => {
          if (!s.isAvailable) return false;
          const [h, m] = s.time.split(":").map(Number);
          return h * 60 + (m || 0) > totalMins;
        });
        setSlots(future.slice(0, 5));
      } else {
        setSlots([]);
      }
      setSlotsLoading(false);
    });
  }, [restaurant.id, restaurant.timezone, restaurant.openDays, party]);

  const open = isOpenNow(
    restaurant.openTime,
    restaurant.closeTime,
    restaurant.timezone ?? "UTC",
    restaurant.openDays
  );
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
      onPress={() => router.push(`/(user)/book/${restaurant.id}`)}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        styles.card,
        cardShadow,
        { backgroundColor: cardBg, borderColor },
        (hovered || pressed) &&
          Platform.OS === "web" && {
            borderColor: isDark ? "#383d47" : "#cfc6b1",
          },
      ]}
    >
      {/* Image area */}
      <View
        style={[
          styles.imageArea,
          restaurant.imageUrl
            ? Platform.OS === "web"
              ? ({
                  backgroundImage: `url(${restaurant.imageUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                } as object)
              : { backgroundColor: "#111" }
            : Platform.OS === "web"
              ? ({
                  background: `linear-gradient(145deg,
                    rgb(${Math.floor(accentR * 0.1)},${Math.floor(accentG * 0.1)},${Math.floor(accentB * 0.13)}) 0%,
                    rgb(${Math.floor(accentR * 0.38)},${Math.floor(accentG * 0.38)},${Math.floor(accentB * 0.42)}) 55%,
                    rgb(${Math.floor(accentR * 0.6)},${Math.floor(accentG * 0.6)},${Math.floor(accentB * 0.65)}) 100%)`,
                } as object)
              : {
                  backgroundColor: `rgb(${Math.floor(accentR * 0.15)},${Math.floor(accentG * 0.15)},${Math.floor(accentB * 0.18)})`,
                },
        ]}
      >
        {/* Native background image via expo-image (web uses CSS backgroundImage above) */}
        {
          // istanbul ignore next
          restaurant.imageUrl && Platform.OS !== "web" && (
            <Image
              source={{ uri: restaurant.imageUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          )
        }
        {/* Branded placeholder content – visible only when no image */}
        {!restaurant.imageUrl && (
          <>
            {/* Decorative ring – top right */}
            <View style={styles.phRingTopRight} />
            {/* Decorative ring – bottom left */}
            <View style={styles.phRingBottomLeft} />
            {/* Centre: icon + initial */}
            <View style={styles.phCenter}>
              <Ionicons name="restaurant-outline" size={28} color="rgba(255,255,255,0.2)" />
              <ThemedText style={styles.phInitial}>
                {restaurant.name.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
          </>
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
            {open && <View style={styles.badgeDot} />}
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
                window.open(`/(user)/book/${restaurant.id}`, "_blank");
              } else {
                router.push(`/(user)/book/${restaurant.id}`);
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
              {party} {party === 1 ? "guest" : "guests"} · today
            </ThemedText>
          </View>
          {slotsLoading ? (
            <ActivityIndicator
              size="small"
              color={primaryColor}
              style={{ alignSelf: "flex-start" }}
            />
          ) : slots.length === 0 ? (
            <ThemedText style={[styles.noSlotsText, { color: mutedColor }]}>
              No available slots today
            </ThemedText>
          ) : (
            <View style={styles.slotRow}>
              {slots.map((s) => (
                <Pressable
                  key={s.time}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    router.push(
                      `/(user)/book/${restaurant.id}?time=${encodeURIComponent(s.time)}&party=${party}`
                    );
                  }}
                  style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                    styles.slot,
                    {
                      backgroundColor: hovered || pressed ? primaryColor : surface2,
                      borderColor: hovered || pressed ? primaryColor : borderColor,
                    },
                  ]}
                >
                  <ThemedText style={styles.slotText}>{s.time}</ThemedText>
                </Pressable>
              ))}
            </View>
          )}
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
            onPress={() => router.push(`/(user)/book/${restaurant.id}`)}
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
    flex: 1,
  },

  // Image area
  imageArea: {
    aspectRatio: 16 / 9,
    position: "relative",
    overflow: "hidden",
  },

  // Branded placeholder (no image)
  phRingTopRight: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 36,
    borderColor: "rgba(255,255,255,0.07)",
    top: -80,
    right: -60,
  },
  phRingBottomLeft: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 28,
    borderColor: "rgba(255,255,255,0.05)",
    bottom: -70,
    left: -50,
  },
  phCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  phInitial: {
    fontSize: 44,
    fontWeight: "700",
    color: "rgba(255,255,255,0.28)",
    letterSpacing: -1.5,
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
    flex: 1,
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
  noSlotsText: {
    fontSize: 12.5,
    fontStyle: "italic",
  },

  // Footer
  cardFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    borderTopWidth: 1,
    borderStyle: "dashed",
    marginTop: "auto" as unknown as number,
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
