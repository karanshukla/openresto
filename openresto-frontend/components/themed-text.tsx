// Side-effect import — see components/common/Button.tsx for why.
import "@/theme/unistyles";
import { Text, type TextProps } from "react-native";
import { StyleSheet } from "react-native-unistyles";
import { useColorScheme } from "@/hooks/use-color-scheme";
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
  const isDark = useColorScheme() === "dark";

  const explicitColor = lightColor && !isDark ? lightColor : darkColor && isDark ? darkColor : "";

  return <Text style={[styles.text(type, explicitColor), style]} {...rest} />;
}

const TYPE_STYLES = {
  ...theme.typography,

  // Legacy Expo template variants
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600" as const,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold" as const,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "bold" as const,
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
  },
} satisfies Record<ThemedTextType, object>;

/**
 * A dynamic function rather than variants: `type` includes a member literally
 * named "default", which Unistyles treats as a variant group's fallback key.
 */
const styles = StyleSheet.create((t) => ({
  text: (type: ThemedTextType, explicitColor: string) => ({
    ...TYPE_STYLES[type],
    color: explicitColor || (type === "link" ? t.colors.primary : t.colors.text),
  }),
}));
