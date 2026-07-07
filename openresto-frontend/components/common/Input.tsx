import { forwardRef } from "react";
import { StyleSheet, TextInput, TextInputProps, View } from "react-native";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";

const Input = forwardRef<TextInput, TextInputProps>(function Input({ style, ...props }, ref) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.container}>
      <TextInput
        ref={ref}
        style={[
          styles.input,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.input },
          style,
        ]}
        placeholderTextColor={colors.muted}
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
    height: theme.formSizes.inputHeight,
    borderWidth: 1,
    borderRadius: theme.formSizes.inputBorderRadius,
    paddingHorizontal: theme.formSizes.inputPaddingH,
    fontSize: theme.formSizes.inputFontSize,
  },
});
