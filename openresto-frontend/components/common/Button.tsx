import { ThemedText } from "@/components/themed-text";
import { Pressable, PressableProps, StyleSheet } from "react-native";

export default function Button({
  children,
  disabled,
  ...props
}: PressableProps & { children: React.ReactNode; disabled?: boolean }) {
  return (
    <Pressable
      style={[styles.button, disabled && styles.disabledButton]}
      disabled={disabled}
      {...props}
    >
      <ThemedText style={styles.buttonText}>{children}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#007BFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  disabledButton: {
    backgroundColor: "#ccc",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
