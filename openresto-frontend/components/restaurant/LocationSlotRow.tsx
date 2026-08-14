import { ActivityIndicator, Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/themed-text";
import type { TimeSlotDto } from "@/api/availability";
import { styles } from "./LocationListItem.styles";

export interface LocationSlotRowProps {
  restaurantId: number;
  restaurantName: string;
  slots: TimeSlotDto[];
  loading: boolean;
  /** How many of `slots` fit on this row; the rest collapse into the overflow affordance. */
  maxShown: number;
  compact: boolean;
  primaryColor: string;
  mutedColor: string;
  borderColor: string;
  surface2: string;
  onBook: (time: string) => void;
}

/**
 * The strip of bookable times under a location's name — a spinner while availability loads,
 * a "no times" line when nothing fits the filters, otherwise the first few slots plus an
 * overflow affordance that opens the location on its earliest time.
 */
export function LocationSlotRow({
  restaurantId,
  restaurantName,
  slots,
  loading,
  maxShown,
  compact,
  primaryColor,
  mutedColor,
  borderColor,
  surface2,
  onBook,
}: LocationSlotRowProps) {
  if (loading) {
    return (
      <ActivityIndicator
        testID={`location-slots-loading-${restaurantId}`}
        size="small"
        color={primaryColor}
        style={styles.slotsLoading}
      />
    );
  }

  const shownSlots = slots.slice(0, maxShown);
  const overflowCount = slots.length - shownSlots.length;

  if (shownSlots.length === 0) {
    return (
      <ThemedText style={[styles.noSlotsText, { color: mutedColor }]}>
        No times available, try another date or party size
      </ThemedText>
    );
  }

  const book = (time: string) => {
    Haptics.selectionAsync();
    onBook(time);
  };

  return (
    <View style={compact ? styles.slotRowCompact : styles.slotRow}>
      {shownSlots.map((s) => (
        <Pressable
          key={s.time}
          onPress={() => book(s.time)}
          accessibilityRole="button"
          accessibilityLabel={`Book ${restaurantName} at ${s.time}`}
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
            onPress={() => book(shownSlots[0].time)}
            accessibilityRole="button"
            accessibilityLabel={`Show all times for ${restaurantName}`}
            style={[styles.slot, styles.slotMoreCompact, { borderColor }]}
          >
            <ThemedText style={[styles.slotMoreText, { color: primaryColor }]}>
              +{overflowCount}
            </ThemedText>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => book(shownSlots[0].time)}
            accessibilityRole="button"
            accessibilityLabel={`Show all times for ${restaurantName}`}
            hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
          >
            <ThemedText style={[styles.slotMoreInline, { color: mutedColor }]}>
              +{overflowCount} more
            </ThemedText>
          </Pressable>
        ))}
    </View>
  );
}

export default LocationSlotRow;
