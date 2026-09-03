import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * What a tab root's scroll content pads at its bottom so its last rows clear the tab bar.
 *
 * Read inside `GuestTabStack`, whose safe-area provider answers for the tab's content area:
 * the bar's height on iOS, where the list runs under a translucent bar, and zero on Android,
 * where the platform lays the content out above an opaque one. Web has no bar to clear. A
 * screen pushed under a native header does not take this — it hands both edges to the scroll
 * view through `contentInsetAdjustmentBehavior`, and taking both would double the bottom.
 *
 * @see [use-tab-bar-clearance.test.tsx](../tests/hooks/use-tab-bar-clearance.test.tsx) — pins
 * the bottom inset off web and nothing on it.
 */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === "web" ? 0 : insets.bottom;
}
