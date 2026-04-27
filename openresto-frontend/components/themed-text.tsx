import { StyleSheet, Text, type TextProps } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";
import { COLORS } from "@/theme/theme";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: "default" | "title" | "defaultSemiBold" | "subtitle" | "link";
};

/**
 * Enhanced Text that automatically responds to theme changes and handles
 * style flattening to prevent React Native Web crashes on native DOM elements.
 */
export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = "default",
  ...rest
}: ThemedTextProps) {
  const { isDark, colors, primaryColor } = useAppTheme();

  let color = lightColor && !isDark ? lightColor : darkColor && isDark ? darkColor : colors.text;

  if (type === "link" && !lightColor && !darkColor) {
    color = primaryColor;
  }

  const flattenedStyle = StyleSheet.flatten([{ color }, styles[type], style]);

  return <Text style={flattenedStyle} {...rest} />;
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
  },
});
