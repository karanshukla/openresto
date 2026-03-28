/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { COLORS, getThemeColors } from "@/theme/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName?: keyof typeof COLORS
): string {
  const isDark = useColorScheme() === "dark";
  const colorFromProps = props[isDark ? "dark" : "light"];

  /* istanbul ignore next -- dark/light branch depends on native color scheme */
  if (colorFromProps) {
    return colorFromProps;
  } else if (colorName && colorName in COLORS) {
    const c = COLORS[colorName as keyof typeof COLORS] as any;
    return typeof c === 'string' ? c : c[isDark ? 'dark' : 'light'];
  } else {
    return isDark ? "#ffffff" : "#000000";
  }
}
