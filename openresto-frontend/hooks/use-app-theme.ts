import { useColorScheme } from "@/hooks/use-color-scheme";
import { getThemeColors, theme } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";
import { useMemo } from "react";

export function useAppTheme() {
  const brand = useBrand();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const colors = useMemo(() => getThemeColors(isDark), [isDark]);

  const primaryColor = brand.primaryColor || theme.colors.primary;

  return { brand, isDark, colors, primaryColor };
}
