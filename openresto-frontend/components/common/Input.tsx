import { forwardRef } from "react";
import { StyleSheet, TextInput, TextInputProps } from "react-native";
import { ThemedView } from "@/components/themed-view";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

const Input = forwardRef<TextInput, TextInputProps>(function Input({ style, ...props }, ref) {
  const colorScheme = useColorScheme() ?? "light";
  const textColor = Colors[colorScheme].text;
  const borderColor = colorScheme === "dark" ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.18)";
  const bgColor = colorScheme === "dark" ? "#1e2022" : "#fff";
  const placeholderColor = colorScheme === "dark" ? "#6b7280" : "#9ca3af";

  return (
    <ThemedView style={styles.container}>
      <TextInput
        ref={ref}
        style={[
          styles.input,
          { color: textColor, borderColor, backgroundColor: bgColor },
          { outlineColor: "#0a7ea4" } as any,
          style,
        ]}
        placeholderTextColor={placeholderColor}
        {...props}
      />
    </ThemedView>
  );
});

export default Input;

const styles = StyleSheet.create({
  container: {
    marginBottom: 0,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
  },
});
