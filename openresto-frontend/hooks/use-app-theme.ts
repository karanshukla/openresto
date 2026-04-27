import { useColorScheme } from "@/hooks/use-color-scheme";
import { getThemeColors } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";
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

  const primaryColor = brand.primaryColor || "#0a7ea4";

  return {
    brand,
    isDark,
    colors,
    primaryColor,
    // Helper for common opacity patterns
    getOpacityColor: (hex: string, opacity: number) => {
      // Basic hex-only opacity helper
      const cleanHex = hex.replace("#", "");
      const op = Math.round(opacity * 255)
        .toString(16)
        .padStart(2, "0");
      return `#${cleanHex}${op}`;
    },
  };
}
