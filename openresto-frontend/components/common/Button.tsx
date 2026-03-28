import { ThemedText } from "@/components/themed-text";
import { Pressable, PressableProps, StyleSheet, ViewStyle } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { COLORS, BUTTON_SIZES, BORDER_RADIUS, getThemeColors } from "@/theme/theme";

interface ButtonProps extends Omit<PressableProps, "style"> {
  children: React.ReactNode;
  disabled?: boolean;
  size?: "primary" | "secondary" | "small" | "icon";
  style?: ViewStyle;
}

export default function Button({ children, disabled, size = "primary", style, ...props }: ButtonProps) {
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const disabledBg = COLORS.disabled[isDark ? "dark" : "light"];
  const disabledTextColor = colors.muted;
  const sizeStyles = BUTTON_SIZES[size];

  return (
    <Pressable
      style={(state) => [
        styles.button,
        sizeStyles,
        (state as { hovered?: boolean }).hovered && !disabled && styles.buttonHovered,
        disabled && { backgroundColor: disabledBg },
        style,
      ]}
      disabled={disabled}
      {...props}
    >
      <ThemedText style={[styles.buttonText, disabled && { color: disabledTextColor }]}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonHovered: {
    backgroundColor: COLORS.primaryDark,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});
