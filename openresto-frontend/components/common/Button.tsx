import { ThemedText } from "@/components/themed-text";
import { Pressable, PressableProps, StyleSheet, ViewStyle } from "react-native";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import * as Haptics from "expo-haptics";

interface ButtonProps extends Omit<PressableProps, "style"> {
  children: React.ReactNode;
  disabled?: boolean;
  size?: "primary" | "secondary" | "small" | "icon";
  style?: ViewStyle;
}

export default function Button({
  children,
  disabled,
  size = "primary",
  style,
  onPress,
  ...props
}: ButtonProps) {
  const { colors, primaryColor } = useAppTheme();
  const sizeStyles = theme.buttonSizes[size];

  const handlePress: PressableProps["onPress"] = (e) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  return (
    <Pressable
      style={(state) => [
        styles.button,
        { backgroundColor: primaryColor },
        sizeStyles,
        /* istanbul ignore next */
        (state as { hovered?: boolean }).hovered && !disabled && { opacity: 0.85 },
        disabled && { backgroundColor: colors.disabled },
        style,
      ]}
      disabled={disabled}
      onPress={handlePress}
      {...props}
    >
      <ThemedText style={[styles.buttonText, disabled && { color: colors.muted }]}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: theme.colors.white,
    ...theme.typography.bodyBold,
  },
});
