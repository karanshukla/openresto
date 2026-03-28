import { View, type ViewProps } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getThemeColors } from "@/theme/theme";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const backgroundColor =
    lightColor && !isDark ? lightColor : darkColor && isDark ? darkColor : colors.page;

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
