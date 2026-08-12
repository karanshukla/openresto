import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAppTheme } from "@/hooks/use-app-theme";
import { RestaurantDto } from "@/api/restaurants";
import { fetchAvailability, TimeSlotDto } from "@/api/availability";
import {
  getHoursForDate,
  getIsoDayFromDateString,
  getNextOpening,
  isoDayShortName,
} from "@/utils/openingHours";
import { isWalkInOnlyOnDay, walkInBadgeLabel } from "@/utils/walkIn";
import { hexToRgb } from "@/utils/colors";
import { groupDisplayName, groupedTableIds } from "@/utils/tableGroups";
import { getOpenDaysList, getRestaurantNow } from "@/utils/restaurantTime";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { cardStyles } from "@/components/restaurant/cardStyles";
import { LinkedText } from "@/components/common/LinkedText";
import OpeningHoursTable from "@/components/restaurant/OpeningHoursTable";
import WalkInNotice from "@/components/booking/WalkInNotice";
import type { MealWindow } from "@/components/restaurant/LocationsFilterBar";
import { styles } from "./LocationListItem.styles";
import { Icon } from "@/components/common/Icon";

const SLOTS_SHOWN_WIDE = 5;
const SLOTS_SHOWN_COMPACT = 3;

/**
 * A single location row in the Locations list: header + times now, details behind an accordion.
 */
export default function LocationListItem({
  restaurant,
  seats,
  date,
  meal,
  today,
  defaultExpanded = false,
  compact = false,
  registerRef,
  onExpand,
  onBook,
  onAvailabilityChange,
}: {
  restaurant: RestaurantDto;
  seats: number;
  date: string;
  meal: MealWindow;
  /** Today's date in the brand's timezone, for "today"-relative copy. */
  today: string;
  defaultExpanded?: boolean;
  /** Phone-width layout: stacked rows, smaller thumbnail, fewer slots. */
  compact?: boolean;
  registerRef: (id: number, ref: View | null) => void;
  onExpand?: (id: number) => void;
  onBook: (restaurant: RestaurantDto, time: string) => void;
  /**
   * Reports how many times this location can offer under the current filters, so the
   * page bar can summarise ("2 of 3 locations have tables"). `null` while loading.
   */
  onAvailabilityChange?: (id: number, availableSlots: number | null) => void;
}) {
  const { colors, isDark, primaryColor } = useAppTheme();
  const mutedColor = colors.muted;
  const borderColor = colors.border;

  // Combinable-table groups (#271-#274). Members stay individually bookable, so the seating
  // minimap marks them rather than hiding them, and lists each group as its own bookable unit.
  const tableGroups = restaurant.groups ?? [];
  // Keyed off restaurant.groups, not tableGroups — the `?? []` fallback is a fresh array each
  // render, which would defeat the memo on locations that have no groups.
  const groupMemberIds = useMemo(
    () => groupedTableIds(restaurant.groups ?? []),
    [restaurant.groups]
  );

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [slots, setSlots] = useState<TimeSlotDto[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const itemRef = useRef<View>(null);

  const tz = restaurant.timezone ?? "UTC";
  const selectedIsoDay = getIsoDayFromDateString(date);
  const isToday = date === today;
  const dayHours = getHoursForDate(restaurant, date);
  const openDaysList = getOpenDaysList(restaurant);
  const closedOnDate = !openDaysList.includes(selectedIsoDay);
  const walkInLocation = !!restaurant.walkInOnly;
  const walkInOnDate = !walkInLocation && isWalkInOnlyOnDay(restaurant, selectedIsoDay);
  const walkInBadgeText = walkInBadgeLabel(restaurant);
  const bookable = !closedOnDate && !walkInLocation && !walkInOnDate;

  useEffect(() => {
    registerRef(restaurant.id, itemRef.current);
    return () => registerRef(restaurant.id, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id]);

  // Refetches whenever the filter bar changes, which is what makes the cards
  // comparable against one another.
  useEffect(() => {
    if (!bookable) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSlots([]);
      setSlotsLoading(false);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    fetchAvailability(restaurant.id, date, seats)
      .then((data) => {
        if (cancelled) return;
        setSlots(data && Array.isArray(data.slots) ? data.slots.filter((s) => s.isAvailable) : []);
        setSlotsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSlots([]);
        setSlotsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id, date, seats, bookable]);

  // Slots the diner can actually take: in the chosen meal window, and — for today —
  // still in the future against the *restaurant's* clock, not the viewer's.
  const usableSlots = useMemo(() => {
    const inWindow = meal === "All" ? slots : slots.filter((s) => s.category === meal);
    if (!isToday) return inWindow;
    const { totalMins } = getRestaurantNow(tz);
    return inWindow.filter((s) => {
      const [h, m] = s.time.split(":").map(Number);
      return h * 60 + (m || 0) > totalMins;
    });
  }, [slots, meal, isToday, tz]);

  useEffect(() => {
    onAvailabilityChange?.(restaurant.id, slotsLoading ? null : usableSlots.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id, usableSlots.length, slotsLoading]);

  const maxShown = compact ? SLOTS_SHOWN_COMPACT : SLOTS_SHOWN_WIDE;
  const shownSlots = usableSlots.slice(0, maxShown);
  const overflowCount = usableSlots.length - shownSlots.length;

  const { r: accentR, g: accentG, b: accentB } = hexToRgb(primaryColor);
  const accentSoft = `rgba(${accentR},${accentG},${accentB},${isDark ? 0.15 : 0.12})`;
  const accentBorder = `rgba(${accentR},${accentG},${accentB},0.3)`;
  const surface2 = colors.surfaceAlt;

  const tags = restaurant.tags ?? [];
  const thumbSize = compact ? 64 : 108;

  const nextOpening = closedOnDate
    ? getNextOpening(restaurant, selectedIsoDay, openDaysList)
    : null;

  const toggleExpanded = () => {
    Haptics.selectionAsync();
    setExpanded((prev) => {
      const next = !prev;
      if (next && onExpand) onExpand(restaurant.id);
      return next;
    });
  };

  const walkInBadge = walkInBadgeText ? (
    <View style={[cardStyles.badge, cardStyles.badgeMuted]}>
      <Icon name="walk-outline" size={11} color="#fff" />
      <ThemedText style={cardStyles.badgeText}>{walkInBadgeText}</ThemedText>
    </View>
  ) : null;

  const detailsToggle = (
    <Pressable
      testID={`location-details-toggle-${restaurant.id}`}
      onPress={toggleExpanded}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={expanded ? "Hide details" : "Show details"}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        cardStyles.viewBtn,
        styles.detailsBtn,
        (hovered || pressed) && { backgroundColor: surface2 },
      ]}
    >
      <ThemedText style={[cardStyles.viewBtnText, { color: primaryColor }]}>Details</ThemedText>
      <Icon name={expanded ? "chevron-up" : "chevron-down"} size={13} color={primaryColor} />
    </Pressable>
  );

  const thumbnail = (
    <View
      style={[
        styles.thumb,
        { width: thumbSize, height: thumbSize },
        restaurant.imageUrl && Platform.OS === "web"
          ? ({
              backgroundImage: `url(${restaurant.imageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            } as object)
          : restaurant.imageUrl
            ? { backgroundColor: "#111" }
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
      {restaurant.imageUrl && Platform.OS !== "web" && !imageError && (
        <Image
          source={{ uri: restaurant.imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onError={() => setImageError(true)}
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      )}
      {!restaurant.imageUrl && (
        <ThemedText style={[styles.thumbInitial, compact && styles.thumbInitialCompact]}>
          {restaurant.name.charAt(0).toUpperCase()}
        </ThemedText>
      )}
    </View>
  );

  const walkInLine =
    walkInLocation || walkInOnDate ? (
      <View style={styles.walkInRow}>
        <Icon name="walk-outline" size={15} color={mutedColor} />
        <ThemedText style={[styles.walkInText, { color: mutedColor }]}>
          No reservations required — first come, first served
        </ThemedText>
      </View>
    ) : null;

  const slotRow = (() => {
    if (!bookable) return walkInLine;
    if (slotsLoading) {
      return (
        <ActivityIndicator
          testID={`location-slots-loading-${restaurant.id}`}
          size="small"
          color={primaryColor}
          style={styles.slotsLoading}
        />
      );
    }
    if (shownSlots.length === 0) {
      return (
        <ThemedText style={[styles.noSlotsText, { color: mutedColor }]}>
          No times available — try another date or party size
        </ThemedText>
      );
    }
    return (
      <View style={compact ? styles.slotRowCompact : styles.slotRow}>
        {shownSlots.map((s) => (
          <Pressable
            key={s.time}
            onPress={() => {
              Haptics.selectionAsync();
              onBook(restaurant, s.time);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Book ${restaurant.name} at ${s.time}`}
            style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
              styles.slot,
              compact && styles.slotCompact,
              {
                backgroundColor: hovered || pressed ? primaryColor : surface2,
                borderColor: hovered || pressed ? primaryColor : borderColor,
              },
            ]}
          >
            <ThemedText style={styles.slotText}>{s.time}</ThemedText>
          </Pressable>
        ))}
        {overflowCount > 0 &&
          (compact ? (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                onBook(restaurant, shownSlots[0].time);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Show all times for ${restaurant.name}`}
              style={[styles.slot, styles.slotMoreCompact, { borderColor }]}
            >
              <ThemedText style={[styles.slotMoreText, { color: primaryColor }]}>
                +{overflowCount}
              </ThemedText>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                onBook(restaurant, shownSlots[0].time);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Show all times for ${restaurant.name}`}
              hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
            >
              <ThemedText style={[styles.slotMoreInline, { color: mutedColor }]}>
                +{overflowCount} more
              </ThemedText>
            </Pressable>
          ))}
      </View>
    );
  })();

  const mapLink = (label: string, url: string) => (
    <Pressable
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        styles.mapLink,
        {
          backgroundColor: surface2,
          borderColor: hovered || pressed ? primaryColor : borderColor,
        },
      ]}
      onPress={() => Linking.openURL(url)}
      accessibilityRole="link"
      accessibilityLabel={`Open in ${label}`}
    >
      <Icon name="navigate-outline" size="xs" color={mutedColor} />
      <ThemedText style={[styles.mapLinkText, { color: mutedColor }]}>{label}</ThemedText>
    </Pressable>
  );

  const menuLink = restaurant.menuUrl ? (
    <Pressable
      style={styles.metaItem}
      onPress={() => Linking.openURL(restaurant.menuUrl!)}
      accessibilityRole="link"
      accessibilityLabel="View menu"
    >
      <Icon name="document-text-outline" size="xs" color={primaryColor} />
      <ThemedText style={[styles.metaText, styles.metaLink, { color: primaryColor }]}>
        Menu
      </ThemedText>
    </Pressable>
  ) : null;

  const dayLabel = isToday ? "today" : isoDayShortName(selectedIsoDay);
  const closedLabel = `Closed ${dayLabel}`;
  const hoursLabel = !closedOnDate
    ? `${dayHours.open} – ${dayHours.close} ${dayLabel}`
    : nextOpening
      ? `${closedLabel} · opens ${isoDayShortName(nextOpening.isoDay)} ${nextOpening.open}`
      : closedLabel;

  const hoursMeta = (
    <View style={styles.metaItem}>
      <Icon name="time-outline" size="xs" color={mutedColor} />
      <ThemedText style={[styles.metaText, { color: mutedColor }]}>{hoursLabel}</ThemedText>
    </View>
  );

  return (
    <View
      ref={itemRef}
      testID={`location-item-${restaurant.id}`}
      style={[
        styles.item,
        { backgroundColor: colors.card, borderColor },
        expanded && { borderColor: colors.borderStrong },
      ]}
    >
      {compact ? (
        <View style={styles.compactHeader}>
          <View style={styles.compactTopRow}>
            {thumbnail}
            <View style={styles.compactIdentity}>
              <ThemedText style={styles.name} numberOfLines={1}>
                {restaurant.name}
              </ThemedText>
              {restaurant.address ? (
                <View style={styles.metaItem}>
                  <Icon name="location-outline" size="xs" color={mutedColor} />
                  <ThemedText style={[styles.metaText, { color: mutedColor }]} numberOfLines={1}>
                    {restaurant.address}
                  </ThemedText>
                </View>
              ) : null}
              {walkInBadge ? <View style={styles.badgeRow}>{walkInBadge}</View> : null}
            </View>
          </View>

          {bookable ? slotRow : null}

          <View style={[styles.compactFoot, { borderTopColor: borderColor }]}>
            {walkInLine ?? hoursMeta}
            {detailsToggle}
          </View>
        </View>
      ) : (
        <View style={styles.wideHeader}>
          {thumbnail}
          <View style={styles.wideContent}>
            <View style={styles.wideTopRow}>
              <View style={styles.wideIdentity}>
                <View style={styles.badgeRow}>
                  <ThemedText style={styles.name} numberOfLines={1}>
                    {restaurant.name}
                  </ThemedText>
                  {walkInBadge}
                </View>
                <View style={styles.metaRow}>
                  {restaurant.address ? (
                    <View style={styles.metaItem}>
                      <Icon name="location-outline" size="xs" color={mutedColor} />
                      <ThemedText
                        style={[styles.metaText, { color: mutedColor }]}
                        numberOfLines={1}
                      >
                        {restaurant.address}
                      </ThemedText>
                    </View>
                  ) : null}
                  {hoursMeta}
                  {menuLink}
                </View>
              </View>
              {detailsToggle}
            </View>
            {slotRow}
          </View>
        </View>
      )}

      <AnimatedAccordion expanded={expanded}>
        <View style={[styles.expandedBody, { borderTopColor: borderColor }]}>
          {restaurant.description ? (
            <LinkedText text={restaurant.description} style={styles.description} />
          ) : null}

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

          {restaurant.menuUrl ? (
            <Pressable
              style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                styles.menuButton,
                {
                  backgroundColor: hovered || pressed ? accentSoft : surface2,
                  borderColor: hovered || pressed ? accentBorder : borderColor,
                },
              ]}
              onPress={() => Linking.openURL(restaurant.menuUrl!)}
              accessibilityRole="link"
              accessibilityLabel="Open menu"
            >
              <Icon name="document-text-outline" size="md" color={primaryColor} />
              <ThemedText style={[styles.menuButtonText, { color: primaryColor }]}>
                View menu
              </ThemedText>
              <Icon name="open-outline" size={13} color={mutedColor} style={styles.menuButtonEnd} />
            </Pressable>
          ) : null}

          {restaurant.address && (
            <View style={styles.mapLinks}>
              {mapLink(
                "Google Maps",
                `https://maps.google.com/?q=${encodeURIComponent(restaurant.address)}`
              )}
              {mapLink(
                "Apple Maps",
                `https://maps.apple.com/?q=${encodeURIComponent(restaurant.address)}`
              )}
            </View>
          )}

          <View style={styles.subSection}>
            <ThemedText type="defaultSemiBold" style={styles.subHeading}>
              Opening hours
            </ThemedText>
            <OpeningHoursTable restaurant={restaurant} />
          </View>

          {walkInLocation && <WalkInNotice scope="location" />}

          {restaurant.sections.length > 0 && (
            <View style={styles.subSection}>
              <ThemedText type="defaultSemiBold" style={styles.subHeading}>
                Seating &amp; tables
              </ThemedText>
              <View style={styles.sectionsGrid}>
                {restaurant.sections.map((section) => (
                  <ThemedView key={section.id} style={[styles.sectionCard, { borderColor }]}>
                    <ThemedText style={styles.sectionName}>{section.name}</ThemedText>
                    <View style={styles.tableGrid}>
                      {section.tables.map((table) => (
                        <View
                          key={table.id}
                          style={[
                            styles.tableChip,
                            {
                              backgroundColor: isDark
                                ? "rgba(255,255,255,0.06)"
                                : "rgba(0,0,0,0.04)",
                              borderColor,
                            },
                          ]}
                        >
                          <View style={styles.tableNameRow}>
                            <ThemedText style={styles.tableName}>
                              {table.name ?? `Table ${table.id}`}
                            </ThemedText>
                            {groupMemberIds.has(table.id) && (
                              <Icon name="link" size={11} color={primaryColor} />
                            )}
                          </View>
                          <ThemedText style={[styles.tableSeats, { color: mutedColor }]}>
                            {table.seats} seats
                          </ThemedText>
                        </View>
                      ))}
                    </View>
                  </ThemedView>
                ))}
              </View>

              {tableGroups.length > 0 && (
                <View style={styles.groupBlock}>
                  <ThemedText style={[styles.groupBlockHeading, { color: mutedColor }]}>
                    Tables we can combine
                  </ThemedText>
                  {tableGroups.map((group) => (
                    <View
                      key={group.id}
                      style={[
                        styles.groupRow,
                        { borderColor: `${primaryColor}55`, backgroundColor: `${primaryColor}12` },
                      ]}
                    >
                      <Icon name="link" size={15} color={primaryColor} />
                      <View style={styles.groupTextCol}>
                        <ThemedText style={styles.groupName}>{groupDisplayName(group)}</ThemedText>
                        <ThemedText style={[styles.groupSeats, { color: mutedColor }]}>
                          Seats up to {group.combinedSeats} pushed together
                        </ThemedText>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      </AnimatedAccordion>
    </View>
  );
}
