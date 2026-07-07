import { useColorScheme } from "@/hooks/use-color-scheme";
import { getThemeColors } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";
import { theme } from "@/theme/theme";
import { useMemo } from "react";

/**
 * Unified hook for accessing brand identity and theme colors.
 * Eliminates repetitive boilerplate in components.
 */
export function useAppTheme() {
  const brand = useBrand();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  // Memoize colors to prevent unnecessary re-renders when passing to style arrays
  const colors = useMemo(() => getThemeColors(isDark), [isDark]);

  const primaryColor = brand.primaryColor || theme.colors.primary;

  return { brand, isDark, colors, primaryColor };
}
