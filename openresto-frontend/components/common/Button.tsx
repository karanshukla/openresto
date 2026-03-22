import { ThemedText } from "@/components/themed-text";
import { Pressable, PressableProps, StyleSheet, ViewStyle } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface ButtonProps extends Omit<PressableProps, "style"> {
  children: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
}

export default function Button({ children, disabled, style, ...props }: ButtonProps) {
  const isDark = useColorScheme() === "dark";
  const disabledBg = isDark ? "#2a2d31" : "#d1d5db";
  const disabledTextColor = isDark ? "#555" : "#9ca3af";

  return (
    <Pressable
      style={(state) => [
        styles.button,
        (state as any).hovered && !disabled && styles.buttonHovered,
        disabled && { backgroundColor: disabledBg },
        style,
        { cursor: disabled ? "not-allowed" : "pointer" } as any,
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
    backgroundColor: "#0a7ea4",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonHovered: {
    backgroundColor: "#085f7a",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
});
