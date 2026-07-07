import { StyleSheet, Text, type TextProps } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";
import { theme } from "@/theme/theme";

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

const styles = StyleSheet.create({
  // theme.typography scale variants
  pageTitle: theme.typography.pageTitle,
  h1: theme.typography.h1,
  h2: theme.typography.h2,
  h3: theme.typography.h3,
  body: theme.typography.body,
  bodyBold: theme.typography.bodyBold,
  label: theme.typography.label,
  labelSmall: theme.typography.labelSmall,
  caption: theme.typography.caption,
  captionSmall: theme.typography.captionSmall,

  // Legacy Expo template variants
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
