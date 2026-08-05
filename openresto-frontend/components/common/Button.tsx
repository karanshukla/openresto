// Side-effect import: guarantees StyleSheet.configure() has run before the
// StyleSheet.create() call below. See docs/unistyles-spike.md — the static web
// export loads modules without ever evaluating the app entry point.
import "@/theme/unistyles";
import { ThemedText } from "@/components/themed-text";
import { Pressable, PressableProps, ViewStyle } from "react-native";
import { StyleSheet } from "react-native-unistyles";
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
  styles.useVariants({ size, disabled: Boolean(disabled) });

  const handlePress: PressableProps["onPress"] = (e) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  return (
    <Pressable style={[styles.button, style]} disabled={disabled} onPress={handlePress} {...props}>
      <ThemedText style={styles.buttonText}>{children}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  button: {
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.primary,
    variants: {
      size: {
        primary: theme.buttonSizes.primary,
        secondary: theme.buttonSizes.secondary,
        small: theme.buttonSizes.small,
        icon: theme.buttonSizes.icon,
      },
      disabled: {
        true: { backgroundColor: theme.colors.disabled },
        false: {
          _web: {
            _hover: { opacity: 0.85 },
          },
        },
      },
    },
  },
  buttonText: {
    color: theme.colors.white,
    ...theme.typography.bodyBold,
    variants: {
      disabled: {
        true: { color: theme.colors.muted },
        false: {},
      },
    },
  },
}));
