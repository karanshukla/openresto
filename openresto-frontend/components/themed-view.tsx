import { View, type ViewProps, StyleSheet } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

/**
 * Enhanced View that automatically responds to theme changes and handles
 * style flattening to prevent React Native Web crashes on native DOM elements.
 */
export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const { isDark, colors } = useAppTheme();

  const backgroundColor =
    lightColor && !isDark ? lightColor : darkColor && isDark ? darkColor : colors.page;

  const flattenedStyle = StyleSheet.flatten([{ backgroundColor }, style]);

  return <View style={flattenedStyle} {...otherProps} />;
}
