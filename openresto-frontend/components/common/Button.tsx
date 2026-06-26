import { ThemedText } from "@/components/themed-text";
import { Pressable, PressableProps, StyleSheet, ViewStyle, Platform } from "react-native";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { COLORS, BUTTON_SIZES, BORDER_RADIUS, TYPOGRAPHY, getThemeColors } from "@/theme/theme";
import { useBrand } from "@/context/BrandContext";
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
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;
  const sizeStyles = BUTTON_SIZES[size];

  const handlePress: PressableProps["onPress"] = (e) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
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
    borderRadius: BORDER_RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: COLORS.white,
    ...TYPOGRAPHY.bodyBold,
  },
});
