import { ThemedText } from "@/components/themed-text";
import { Pressable, PressableProps, StyleSheet, ViewStyle } from "react-native";

interface ButtonProps extends Omit<PressableProps, "style"> {
  children: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
}

export default function Button({ children, disabled, style, ...props }: ButtonProps) {
  return (
    <Pressable
      style={(state) => [
        styles.button,
        (state as any).hovered && !disabled && styles.buttonHovered,
        disabled && styles.disabledButton,
        style,
        { cursor: disabled ? "not-allowed" : "pointer" } as any,
      ]}
      disabled={disabled}
      {...props}
    >
      <ThemedText style={[styles.buttonText, disabled && styles.disabledText]}>
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
  disabledButton: {
    backgroundColor: "#d1d5db",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  disabledText: {
    color: "#9ca3af",
  },
});
