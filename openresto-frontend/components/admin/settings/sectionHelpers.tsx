import { Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";

/**
 * Shared presentational helpers for the RestaurantInfoForm sub-section components.
 * Extracted from the original monolithic form during Bundle 9B-1 decomposition.
 */

export const DAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 7,
        backgroundColor: active ? (isDark ? "#33363a" : "#fff") : "transparent",
        ...(active && {
          borderWidth: 1,
          borderColor,
        }),
      }}
    >
      <ThemedText
        style={{
          fontSize: 12,
          fontWeight: active ? "600" : "500",
          color: active ? textColor : mutedColor,
        }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}
