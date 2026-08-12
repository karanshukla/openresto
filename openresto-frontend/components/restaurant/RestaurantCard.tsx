import { ThemedText } from "@/components/themed-text";
import { RestaurantDto } from "@/api/restaurants";
import { useRouter, type Href } from "expo-router";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEffect, useState } from "react";
import { fetchAvailability, TimeSlotDto } from "@/api/availability";
import { getHoursForDay, hasCustomHours } from "@/utils/openingHours";
import { isWalkInOnlyOnDay, walkInBadgeLabel } from "@/utils/walkIn";
import { hexToRgb } from "@/utils/colors";
import { getRestaurantDate, getRestaurantNow, getOpenDaysList } from "@/utils/restaurantTime";
import { cardStyles, openBadgeColor } from "@/components/restaurant/cardStyles";
import { styles } from "./RestaurantCard.styles";
import { Icon } from "@/components/common/Icon";

function opensLaterToday(restaurant: RestaurantDto): string | null {
  const timezone = restaurant.timezone ?? "UTC";
  const { totalMins, isoDay } = getRestaurantNow(timezone || "UTC");
  const { open: openTime } = getHoursForDay(restaurant, isoDay);
  const [oh, om] = openTime.split(":").map(Number);
  const openDaysList = getOpenDaysList(restaurant);
  if (openDaysList.length > 0 && !openDaysList.includes(isoDay)) return null;
  const openMins = oh * 60 + (om || 0);
  if (totalMins >= openMins) return null;
  const diffMins = openMins - totalMins;
  const diffHours = Math.floor(diffMins / 60);
  const diffRemMins = diffMins % 60;
  if (diffHours >= 1 && diffRemMins === 0) return `Opens in ${diffHours}h`;
  if (diffHours >= 1) return `Opens in ${diffHours}h ${diffRemMins}m`;
  return `Opens in ${diffMins}m`;
}

function isOpenNow(restaurant: RestaurantDto): boolean {
  const timezone = restaurant.timezone ?? "UTC";
  const { totalMins, isoDay } = getRestaurantNow(timezone || "UTC");
  const { open: openTime, close: closeTime } = getHoursForDay(restaurant, isoDay);
  const [oh, om] = openTime.split(":").map(Number);
  const [ch, cm] = closeTime.split(":").map(Number);
  if (isNaN(oh) || isNaN(ch)) return true;
  const openDaysList = getOpenDaysList(restaurant);
  if (openDaysList.length > 0 && !openDaysList.includes(isoDay)) return false;
  return totalMins >= oh * 60 + om && totalMins < ch * 60 + cm;
}

export default function RestaurantCard({
  restaurant,
  party = 2,
}: {
  restaurant: RestaurantDto;
  party?: number;
}) {
  const { colors, isDark, primaryColor } = useAppTheme();
  const mutedColor = colors.muted;
  const router = useRouter();

  // Every route this card can take answers a tap, so each one confirms the tap first.
  // Haptics.selectionAsync is a no-op on web and on devices without a taptic engine.
  const openLocation = () => {
    Haptics.selectionAsync();
    router.push(`/(user)/locations/${restaurant.id}` as Href);
  };

  const [slots, setSlots] = useState<TimeSlotDto[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);

  useEffect(() => {
    const tz = restaurant.timezone ?? "UTC";
    const { totalMins, isoDay } = getRestaurantNow(tz);
    const openDaysList = getOpenDaysList(restaurant);
    if (
      (openDaysList.length > 0 && !openDaysList.includes(isoDay)) ||
      isWalkInOnlyOnDay(restaurant, isoDay)
    ) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    restaurant.id,
    restaurant.timezone,
    restaurant.openDays,
    restaurant.walkInOnly,
    restaurant.walkInDays,
    party,
  ]);

  const open = isOpenNow(restaurant);
  const opensLabel = !open ? opensLaterToday(restaurant) : null;
  const walkInLocation = !!restaurant.walkInOnly;
  const walkInToday =
    !walkInLocation &&
    isWalkInOnlyOnDay(restaurant, getRestaurantNow(restaurant.timezone ?? "UTC").isoDay);
  const walkInBadgeText = walkInBadgeLabel(restaurant);
  const todayIsoDay = getRestaurantNow(restaurant.timezone ?? "UTC").isoDay;
  const todayHours = getHoursForDay(restaurant, todayIsoDay);
  const hoursVary = hasCustomHours(restaurant);
  const closedToday = !getOpenDaysList(restaurant).includes(todayIsoDay);
  const tags = restaurant.tags ?? [];

  const { r: accentR, g: accentG, b: accentB } = hexToRgb(primaryColor);
  const accentSoft = `rgba(${accentR},${accentG},${accentB},0.12)`;
  const accentBorder = `rgba(${accentR},${accentG},${accentB},0.3)`;

  const cardBg = colors.card;
  const borderColor = colors.border;
  const surface2 = colors.surfaceAlt;

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
      accessibilityRole="link"
      accessibilityLabel={`${restaurant.name}, view details and book`}
      onPress={() => openLocation()}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        styles.card,
        cardShadow,
        { backgroundColor: cardBg, borderColor },
        hovered && Platform.OS === "web" && { borderColor: colors.borderStrong },
        // Touch has no hover to fall back on, so the press itself has to answer: the
        // whole card takes the accent edge and settles a hair into the page.
        pressed && { borderColor: primaryColor, transform: [{ scale: 0.99 }] },
      ]}
    >
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
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          )
        }
        {!restaurant.imageUrl && (
          <>
            <View style={styles.phRingTopRight} />
            <View style={styles.phRingBottomLeft} />
            <View style={styles.phCenter}>
              <Icon name="restaurant-outline" size={28} color="rgba(255,255,255,0.2)" />
              <ThemedText style={styles.phInitial}>
                {restaurant.name.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
          </>
        )}

        <View style={styles.imageTopRow}>
          <View
            style={[
              cardStyles.badge,
              open
                ? { backgroundColor: openBadgeColor(accentR, accentG, accentB) }
                : opensLabel
                  ? { backgroundColor: `rgba(${accentR},${accentG},${accentB},0.72)` }
                  : cardStyles.badgeMuted,
            ]}
          >
            {open && <View style={cardStyles.badgeDot} />}
            <ThemedText style={cardStyles.badgeText}>
              {open ? `Open till ${todayHours.close}` : (opensLabel ?? "Closed")}
            </ThemedText>
          </View>
          {walkInBadgeText && (
            <View style={[cardStyles.badge, cardStyles.badgeMuted]} testID="walk-in-badge">
              <Icon name="walk-outline" size="xs" color="#fff" />
              <ThemedText style={cardStyles.badgeText}>{walkInBadgeText}</ThemedText>
            </View>
          )}
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ThemedText style={styles.name} numberOfLines={1}>
              {restaurant.name}
            </ThemedText>
            <View style={styles.meta}>
              <Icon name="location-outline" size={11} color={mutedColor} />
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
                  accessibilityRole="link"
                  accessibilityLabel="Open in Google Maps"
                >
                  <Icon name="navigate-outline" size={11} color={mutedColor} />
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
                  accessibilityRole="link"
                  accessibilityLabel="Open in Apple Maps"
                >
                  <Icon name="navigate-outline" size={11} color={mutedColor} />
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
                window.open(`/(user)/locations/${restaurant.id}`, "_blank");
              } else {
                router.push(`/(user)/locations/${restaurant.id}` as Href);
              }
            }}
            accessibilityRole="link"
            accessibilityLabel="Open booking page in new tab"
          >
            <Icon name="open-outline" size="sm" color={mutedColor} />
          </Pressable>
        </View>

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

        {/* Time slots (or a no-reservations-needed empty state when bookings are disabled).
            Wrapped in a fixed-min-height area so cards line up whether or not they show slots. */}
        <View style={styles.slotsArea}>
          {walkInLocation || walkInToday ? (
            <View style={styles.walkInEmptyState} testID="walk-in-slot-notice">
              <Icon name="walk-outline" size="lg" color={mutedColor} />
              <ThemedText style={[styles.walkInEmptyText, { color: mutedColor }]}>
                No reservations required
              </ThemedText>
            </View>
          ) : (
            <>
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
                        Haptics.selectionAsync();
                        router.push(
                          `/(user)/locations/${restaurant.id}?time=${encodeURIComponent(s.time)}&party=${party}` as Href
                        );
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Book ${s.time} at ${restaurant.name}`}
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
            </>
          )}
        </View>

        <View style={[styles.cardFoot, { borderTopColor: borderColor }]}>
          <View style={styles.hoursRow}>
            <Icon name="time-outline" size="xs" color={mutedColor} style={{ marginRight: 5 }} />
            {closedToday ? (
              <ThemedText style={[styles.hoursTime, { color: colors.text }]}>
                Closed today
              </ThemedText>
            ) : (
              <>
                <ThemedText style={[styles.hoursText, { color: mutedColor }]}>
                  {hoursVary ? "Today " : "Open "}
                </ThemedText>
                <ThemedText style={[styles.hoursTime, { color: colors.text }]}>
                  {todayHours.open} – {todayHours.close}
                </ThemedText>
              </>
            )}
          </View>
          <Pressable
            style={({ pressed }) => [cardStyles.viewBtn, pressed && { backgroundColor: surface2 }]}
            onPress={() => openLocation()}
            accessibilityRole="link"
            accessibilityLabel={`See details for ${restaurant.name}`}
          >
            <ThemedText style={[cardStyles.viewBtnText, { color: primaryColor }]}>
              See details
            </ThemedText>
            <Icon name="arrow-forward" size={13} color={primaryColor} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
