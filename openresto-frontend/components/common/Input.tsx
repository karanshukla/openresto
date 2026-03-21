import { StyleSheet, TextInput, TextInputProps } from "react-native";
import { ThemedView } from "@/components/themed-view";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

export default function Input(props: TextInputProps) {
  const colorScheme = useColorScheme() ?? "light";
  const textColor = Colors[colorScheme].text;
  const borderColor = colorScheme === "dark"
    ? "rgba(255,255,255,0.15)"
    : "rgba(0,0,0,0.18)";
  const bgColor = colorScheme === "dark" ? "#1e2022" : "#fff";
  const placeholderColor = colorScheme === "dark" ? "#6b7280" : "#9ca3af";

  return (
    <ThemedView style={styles.container}>
      <TextInput
        style={[
          styles.input,
          {
            color: textColor,
            borderColor,
            backgroundColor: bgColor,
          },
          { outlineColor: "#0a7ea4" } as any,
        ]}
        placeholderTextColor={placeholderColor}
        {...props}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
  },
});
