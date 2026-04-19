import { forwardRef } from "react";
import { StyleSheet, TextInput, TextInputProps, View } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getThemeColors } from "@/theme/theme";

const Input = forwardRef<TextInput, TextInputProps>(function Input({ style, ...props }, ref) {
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const borderColor = colors.border;
  const placeholderColor = colors.muted;

  return (
    <View style={styles.container}>
      <TextInput
        ref={ref}
        style={[
          styles.input,
          { color: colors.text, borderColor, backgroundColor: colors.input },
          style,
        ]}
        placeholderTextColor={placeholderColor}
        {...props}
      />
    </View>
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
