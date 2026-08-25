import { Pressable } from "react-native";
import type { TFunction } from "i18next";
import { ThemedText } from "@/components/themed-text";
import { styles } from "./sectionHelpers.styles";

/**
 * Shared presentational helpers for the RestaurantInfoForm sub-section components.
 * Extracted from the original monolithic form during Bundle 9B-1 decomposition.
 */

const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const WEEKDAY_SHORT_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/**
 * `getDayLabels`/`getDayShort` return weekday display strings, indexed 0=Monday…6=Sunday to
 * match the ISO day numbers (`day = index + 1`) that `OpeningHoursSection` and
 * `WalkInPolicySection` store on the wire. Only the label localizes — the index arithmetic
 * that turns it into an ISO day number is unaffected by the active locale.
 * @see [sectionHelpers.test.tsx](../../../tests/components/admin/settings/sectionHelpers.test.tsx)
 * — pins that the labels change with locale while the day count stays 7 in every locale.
 */
export function getDayLabels(t: TFunction): string[] {
  return WEEKDAY_KEYS.map((key) => t(`admin.settings.weekdays.${key}`));
}

export function getDayShort(t: TFunction): string[] {
  return WEEKDAY_SHORT_KEYS.map((key) => t(`admin.settings.weekdays.${key}`));
}

/** True when a closing time is at or before the opening time (i.e. closes after midnight). */
export function isOvernight(open: string, close: string): boolean {
  return close <= open;
}

/**
 * The segmented-control pill button used by both the opening-hours mode toggle and the
 * walk-in policy mode toggle. `active` drives the selected styling + a11y state.
 */
export function modeButton(
  label: string,
  active: boolean,
  onPress: () => void,
  testID: string,
  theme: {
    borderColor: string;
    mutedColor: string;
    textColor: string;
    isDark: boolean;
  }
) {
  const { borderColor, mutedColor, textColor, isDark } = theme;
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.modeBtn,
        active && [
          styles.modeBtnActive,
          { backgroundColor: isDark ? "#33363a" : "#fff", borderColor },
        ],
      ]}
    >
      <ThemedText
        style={[
          styles.modeBtnLabel,
          active && styles.modeBtnLabelActive,
          { color: active ? textColor : mutedColor },
        ]}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}
