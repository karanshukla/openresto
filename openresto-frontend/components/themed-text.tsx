import { StyleSheet, Text, type TextProps } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./themed-text.styles";

export type ThemedTextType =
  // theme.typography-aligned variants (prefer these)
  | "pageTitle"
  | "h1"
  | "h2"
  | "h3"
  | "body"
  | "bodyBold"
  | "label"
  | "labelSmall"
  | "caption"
  | "captionSmall"
  // Legacy Expo template variants (kept for backwards compat)
  | "default"
  | "defaultSemiBold"
  | "title"
  | "subtitle"
  | "link";

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemedTextType;
};

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
