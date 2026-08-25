import { View } from "react-native";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";
import { ThemedText } from "@/components/themed-text";
import Select, { type SelectOption } from "@/components/common/Select";
import DatePicker from "@/components/common/DatePicker";
import { useAppTheme } from "@/hooks/use-app-theme";
import { fmtDateString } from "@/utils/formatters";
import { styles } from "./LocationsFilterBar.styles";

/**
 * The meal window the Locations list is filtered to. Mirrors `TimeSlotDto.category`
 * plus an "All" escape hatch, so the page-level bar and the in-drawer
 * `PopularTimesPicker` speak the same vocabulary.
 */
export type MealWindow = "Lunch" | "Dinner" | "All";

function mealOptions(compact: boolean): SelectOption[] {
  const all = compact
    ? i18n.t("restaurant.filterBar.all")
    : i18n.t("restaurant.filterBar.allTimes");
  return [
    { label: i18n.t("restaurant.filterBar.lunch"), value: "Lunch" },
    { label: i18n.t("restaurant.filterBar.dinner"), value: "Dinner" },
    { label: all, value: "All" },
  ];
}

function seatOptions(compact: boolean): SelectOption[] {
  return [...Array(10).keys()].map((i) => ({
    label: compact ? String(i + 1) : i18n.t("restaurant.filterBar.guestCount", { count: i + 1 }),
    value: i + 1,
  }));
}

export function formatBarDate(date: string, today: string, compact: boolean): string {
  const isToday = date === today;
  if (compact) return isToday ? i18n.t("restaurant.filterBar.today") : shortDate(date);
  return isToday
    ? i18n.t("restaurant.filterBar.todayDate", { date: shortDate(date) })
    : shortDate(date);
}

function shortDate(date: string): string {
  return fmtDateString(date);
}

/** Page-level party/date/meal bar for the Locations list. */
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
  raised,
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
  /** Set while the bar is pinned, where it floats over the list rather than sitting in it. */
  raised?: boolean;
}) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();

  return (
    <View
      testID="locations-filter-bar"
      style={[
        styles.bar,
        compact && styles.barCompact,
        { backgroundColor: colors.card },
        raised && styles.barRaised,
      ]}
    >
      <View
        testID="filter-control-seats"
        style={compact ? styles.controlCompactSeats : styles.controlSeats}
      >
        <Select
          icon="people-outline"
          accessibilityLabel={t("restaurant.filterBar.numberOfGuests")}
          options={seatOptions(!!compact)}
          selectedValue={seats}
          onSelect={(v) => onSeatsChange(v as number)}
        />
      </View>

      <View style={compact ? styles.controlCompactWide : styles.controlDate}>
        <DatePicker
          icon={compact ? undefined : "calendar-outline"}
          triggerLabel={formatBarDate(date, today, !!compact)}
          selectedDate={date}
          onSelect={onDateChange}
        />
      </View>

      <View style={compact ? styles.controlCompactWide : styles.controlMeal}>
        <Select
          icon={compact ? undefined : "time-outline"}
          accessibilityLabel={t("restaurant.filterBar.timeOfDay")}
          options={mealOptions(!!compact)}
          selectedValue={meal}
          onSelect={(v) => onMealChange(v as MealWindow)}
        />
      </View>

      {!compact && summary ? (
        <ThemedText
          style={[styles.summary, { color: colors.muted }]}
          role="status"
          accessibilityLiveRegion="polite"
        >
          {summary}
        </ThemedText>
      ) : null}
    </View>
  );
}
