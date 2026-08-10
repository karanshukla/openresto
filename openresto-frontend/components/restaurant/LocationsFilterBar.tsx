import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Select from "@/components/common/Select";
import DatePicker from "@/components/common/DatePicker";
import { useAppTheme } from "@/hooks/use-app-theme";
import { theme } from "@/theme/theme";
import { styles } from "./LocationsFilterBar.styles";

/**
 * The meal window the Locations list is filtered to. Mirrors `TimeSlotDto.category`
 * plus an "All" escape hatch, so the page-level bar and the in-drawer
 * `PopularTimesPicker` speak the same vocabulary.
 */
export type MealWindow = "Lunch" | "Dinner" | "All";

const MEAL_OPTIONS = [
  { label: "Lunch", value: "Lunch" },
  { label: "Dinner", value: "Dinner" },
  { label: "All times", value: "All" },
];

const SEAT_OPTIONS = [...Array(10).keys()].map((i) => ({
  label: `${i + 1} ${i === 0 ? "guest" : "guests"}`,
  value: i + 1,
}));

/** Compact seat labels for the narrow mobile bar, where "2 guests" doesn't fit. */
const SEAT_OPTIONS_COMPACT = SEAT_OPTIONS.map((o) => ({ ...o, label: String(o.value) }));

export function formatBarDate(date: string, today: string, compact: boolean): string {
  const isToday = date === today;
  if (compact) return isToday ? "Today" : shortDate(date);
  return isToday ? `Today, ${shortDate(date)}` : shortDate(date);
}

function shortDate(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Page-level party/date/meal bar for the Locations list. These three inputs used to
 * live inside every location's own booking form, which made the cards impossible to
 * compare — each one answered a different question. Hoisting them here means one set
 * of criteria drives every card's slot row at once.
 */
export default function LocationsFilterBar({
  seats,
  onSeatsChange,
  date,
  onDateChange,
  today,
  meal,
  onMealChange,
  summary,
  compact,
}: {
  seats: number;
  onSeatsChange: (seats: number) => void;
  date: string;
  onDateChange: (date: string) => void;
  /** Today's date in the brand's timezone, for the "Today, …" trigger label. */
  today: string;
  meal: MealWindow;
  onMealChange: (meal: MealWindow) => void;
  /** e.g. "2 of 3 locations have tables". Hidden on the compact bar. */
  summary?: string | null;
  compact?: boolean;
}) {
  const { colors } = useAppTheme();

  return (
    <View
      testID="locations-filter-bar"
      style={[
        styles.bar,
        compact && styles.barCompact,
        { backgroundColor: colors.card, borderColor: colors.border },
        theme.shadows.sm,
      ]}
    >
      <View style={compact ? styles.controlCompactSeats : styles.controlSeats}>
        <Select
          icon="people-outline"
          accessibilityLabel="Number of guests"
          options={compact ? SEAT_OPTIONS_COMPACT : SEAT_OPTIONS}
          selectedValue={seats}
          onSelect={(v) => onSeatsChange(v as number)}
        />
      </View>

      <View style={compact ? styles.controlCompactWide : styles.controlDate}>
        <DatePicker
          icon="calendar-outline"
          triggerLabel={formatBarDate(date, today, !!compact)}
          selectedDate={date}
          onSelect={onDateChange}
        />
      </View>

      <View style={compact ? styles.controlCompactWide : styles.controlMeal}>
        <Select
          icon="time-outline"
          accessibilityLabel="Time of day"
          options={MEAL_OPTIONS}
          selectedValue={meal}
          onSelect={(v) => onMealChange(v as MealWindow)}
        />
      </View>

      {!compact && summary ? (
        <ThemedText style={[styles.summary, { color: colors.muted }]}>{summary}</ThemedText>
      ) : null}
    </View>
  );
}
