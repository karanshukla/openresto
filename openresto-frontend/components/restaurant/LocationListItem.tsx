import { useEffect, useRef, useState } from "react";
import { GestureResponderEvent, Linking, Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { RestaurantDto } from "@/api/restaurants";
import {
  getHoursForDate,
  getIsoDayFromDateString,
  getNextOpening,
  isoDayShortName,
} from "@/utils/openingHours";
import { isWalkInOnlyOnDay, walkInBadgeLabel } from "@/utils/walkIn";
import { hexToRgb } from "@/utils/colors";
import { getOpenDaysList } from "@/utils/restaurantTime";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { cardStyles } from "@/components/restaurant/cardStyles";
import type { MealWindow } from "@/components/restaurant/LocationsFilterBar";
import { LocationDetailsPanel } from "./LocationDetailsPanel";
import { LocationSlotRow } from "./LocationSlotRow";
import { LocationThumbnail } from "./LocationThumbnail";
import { useLocationSlots } from "./useLocationSlots";
import { styles } from "./LocationListItem.styles";
import { Icon } from "@/components/common/Icon";
import Button from "@/components/common/Button";

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

  const [expanded, setExpanded] = useState(defaultExpanded);
  const itemRef = useRef<View>(null);

  const selectedIsoDay = getIsoDayFromDateString(date);
  const isToday = date === today;
  const dayHours = getHoursForDate(restaurant, date);
  const openDaysList = getOpenDaysList(restaurant);
  const closedOnDate = !openDaysList.includes(selectedIsoDay);
  const walkInLocation = !!restaurant.walkInOnly;
  const walkInOnDate = !walkInLocation && isWalkInOnlyOnDay(restaurant, selectedIsoDay);
  const walkInBadgeText = walkInBadgeLabel(restaurant);
  /** Whether the selected date can be booked — governs the slot strip. */
  const bookable = !closedOnDate && !walkInLocation && !walkInOnDate;
  /**
   * Whether the location takes online bookings on *any* day — governs the Book now CTA.
   * Today being shut, or walk-in only, is no reason to withhold the route to next Tuesday;
   * the panel opens on the notice for this day and its date picker moves the diner on. Only
   * a location with no bookable day anywhere has nothing behind the button.
   */
  const takesOnlineBookings = openDaysList.some((day) => !isWalkInOnlyOnDay(restaurant, day));

  useEffect(() => {
    registerRef(restaurant.id, itemRef.current);
    return () => registerRef(restaurant.id, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id]);

  const { slotsLoading, usableSlots } = useLocationSlots({
    restaurantId: restaurant.id,
    date,
    seats,
    meal,
    bookable,
    isToday,
    timezone: restaurant.timezone ?? "UTC",
    onAvailabilityChange,
  });

  const accent = hexToRgb(primaryColor);
  const accentSoft = `rgba(${accent.r},${accent.g},${accent.b},${isDark ? 0.15 : 0.12})`;
  const accentBorder = `rgba(${accent.r},${accent.g},${accent.b},0.3)`;
  const surface2 = colors.surfaceAlt;

  const nextOpening = closedOnDate
    ? getNextOpening(restaurant, selectedIsoDay, openDaysList)
    : null;

  const toggleExpanded = (event?: GestureResponderEvent) => {
    // The card body is the toggle, so the controls sitting on top of it (the menu link, the
    // Details and Book now buttons) have to keep their press from reaching it.
    event?.stopPropagation?.();
    Haptics.selectionAsync();
    setExpanded((prev) => {
      const next = !prev;
      if (next && onExpand) onExpand(restaurant.id);
      return next;
    });
  };

  const bodyPressProps = {
    onPress: toggleExpanded,
    accessibilityRole: "button" as const,
    accessibilityState: { expanded },
    accessibilityLabel: expanded
      ? `Hide details for ${restaurant.name}`
      : `Show details for ${restaurant.name}`,
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

  // Opens the booking panel without going through a time chip — the diner may want a time
  // that isn't on the strip, and a location with nothing free today has no chip to press at
  // all. The panel's own pickers take it from here, so the earliest slot is only a seed.
  const bookNowButton = takesOnlineBookings ? (
    <Button
      testID={`location-book-now-${restaurant.id}`}
      size="sm"
      accessibilityLabel={`Book a table at ${restaurant.name}`}
      onPress={(event) => {
        // Button fires its own haptic; this only has to keep the press off the card body.
        event?.stopPropagation?.();
        onBook(restaurant, usableSlots[0]?.time ?? dayHours.open);
      }}
    >
      Book now
    </Button>
  ) : null;

  const headerActions = (
    <View style={styles.headerActions}>
      {detailsToggle}
      {bookNowButton}
    </View>
  );

  const thumbnail = (
    <LocationThumbnail
      name={restaurant.name}
      imageUrl={restaurant.imageUrl}
      size={compact ? 64 : 108}
      compact={compact}
      accent={accent}
    />
  );

  const walkInLine =
    walkInLocation || walkInOnDate ? (
      <View style={styles.walkInRow}>
        <Icon name="walk-outline" size={15} color={mutedColor} />
        <ThemedText style={[styles.walkInText, { color: mutedColor }]}>
          No reservations required, first come first served
        </ThemedText>
      </View>
    ) : null;

  const slotRow = bookable ? (
    <LocationSlotRow
      restaurantId={restaurant.id}
      restaurantName={restaurant.name}
      slots={usableSlots}
      loading={slotsLoading}
      maxShown={compact ? SLOTS_SHOWN_COMPACT : SLOTS_SHOWN_WIDE}
      compact={compact}
      primaryColor={primaryColor}
      mutedColor={mutedColor}
      borderColor={borderColor}
      surface2={surface2}
      onBook={(time) => onBook(restaurant, time)}
    />
  ) : (
    walkInLine
  );

  const addressMeta = restaurant.address ? (
    <View style={styles.metaItem}>
      <Icon name="location-outline" size="xs" color={mutedColor} />
      <ThemedText style={[styles.metaText, { color: mutedColor }]} numberOfLines={1}>
        {restaurant.address}
      </ThemedText>
    </View>
  ) : null;

  const menuLink = restaurant.menuUrl ? (
    <Pressable
      style={styles.metaItem}
      onPress={(event) => {
        event?.stopPropagation?.();
        Linking.openURL(restaurant.menuUrl!);
      }}
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
          <Pressable
            {...bodyPressProps}
            testID={`location-body-${restaurant.id}`}
            style={styles.compactTopRow}
          >
            {thumbnail}
            <View style={styles.compactIdentity}>
              <ThemedText style={styles.name} numberOfLines={1}>
                {restaurant.name}
              </ThemedText>
              {addressMeta}
              {walkInBadge ? <View style={styles.badgeRow}>{walkInBadge}</View> : null}
            </View>
          </Pressable>

          {bookable ? slotRow : null}

          <View style={[styles.compactFoot, { borderTopColor: borderColor }]}>
            <View testID={`location-foot-lead-${restaurant.id}`} style={styles.compactFootLead}>
              {walkInLine ?? hoursMeta}
            </View>
            {headerActions}
          </View>
        </View>
      ) : (
        <View style={styles.wideHeader}>
          {thumbnail}
          <View style={styles.wideContent}>
            <View style={styles.wideTopRow}>
              <Pressable
                {...bodyPressProps}
                testID={`location-body-${restaurant.id}`}
                style={styles.wideIdentity}
              >
                <View style={styles.badgeRow}>
                  <ThemedText style={styles.name} numberOfLines={1}>
                    {restaurant.name}
                  </ThemedText>
                  {walkInBadge}
                </View>
                <View style={styles.metaRow}>
                  {addressMeta}
                  {hoursMeta}
                  {menuLink}
                </View>
              </Pressable>
              {headerActions}
            </View>
            {slotRow}
          </View>
        </View>
      )}

      <AnimatedAccordion expanded={expanded}>
        <LocationDetailsPanel
          restaurant={restaurant}
          walkInLocation={walkInLocation}
          isDark={isDark}
          borderColor={borderColor}
          mutedColor={mutedColor}
          primaryColor={primaryColor}
          surface2={surface2}
          accentSoft={accentSoft}
          accentBorder={accentBorder}
        />
      </AnimatedAccordion>
    </View>
  );
}
