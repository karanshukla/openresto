import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { styles } from "@/components/admin/bookings/bookings.styles";
import type { SortKey, SortState } from "@/components/admin/bookings/sorting";

export interface BookingsSortControlProps {
  sort: SortState;
  onSortChange: (key: SortKey) => void;
  /** Theme values passed from the orchestrating screen (presentational). */
  borderColor: string;
  cardBg: string;
  mutedColor: string;
  primaryColor: string;
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Time" },
  { key: "guest", label: "Guest" },
  { key: "seats", label: "Party" },
  { key: "table", label: "Table" },
  { key: "status", label: "Status" },
];

/**
 * Sort affordance for the mobile card list — column headers don't apply to a
 * card layout, so this offers the same sort axes as the wide table via a row of
 * chips, each with a direction toggle (tap the active chip to flip asc/desc).
 * Presentational; the screen owns the sort state.
 */
export function BookingsSortControl({
  sort,
  onSortChange,
  borderColor,
  cardBg,
  mutedColor,
  primaryColor,
}: BookingsSortControlProps) {
  return (
    <View style={[styles.sortControl, { borderColor, backgroundColor: cardBg }]}>
      <ThemedText style={[styles.sortControlLabel, { color: mutedColor }]}>Sort</ThemedText>
      <View style={styles.sortControlChips}>
        {COLUMNS.map(({ key, label }) => {
          const isActive = sort.key === key;
          const dirLabel = isActive
            ? sort.dir === "asc"
              ? "ascending"
              : "descending"
            : "not sorted";
          return (
            <Pressable
              key={key}
              testID={`sort-chip-${key}`}
              accessibilityRole="button"
              accessibilityLabel={`Sort by ${label}, ${dirLabel}`}
              style={[
                styles.sortChip,
                { borderColor: isActive ? primaryColor : borderColor },
                isActive && { backgroundColor: primaryColor },
              ]}
              onPress={() => onSortChange(key)}
            >
              <ThemedText
                style={[
                  styles.sortChipText,
                  { color: isActive ? "#fff" : mutedColor },
                  isActive && styles.sortChipTextActive,
                ]}
              >
                {label}
              </ThemedText>
              <Ionicons
                name={
                  !isActive
                    ? "swap-vertical-outline"
                    : sort.dir === "asc"
                      ? "chevron-up-outline"
                      : "chevron-down-outline"
                }
                size={11}
                color={isActive ? "#fff" : mutedColor}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
