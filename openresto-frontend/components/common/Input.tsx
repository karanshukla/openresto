import { forwardRef } from "react";
import { TextInput, TextInputProps, View } from "react-native";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./Input.styles";

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
