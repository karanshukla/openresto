import { Children } from "react";
import { ActivityIndicator, Pressable, PressableProps, View, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/themed-text";
import { Icon, type IconName } from "@/components/common/Icon";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./Button.styles";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = keyof typeof theme.buttonSizes;

interface ButtonProps extends Omit<PressableProps, "style" | "children"> {
  children: React.ReactNode;
  disabled?: boolean;
  /** Visual treatment. Independent of `size`. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Renders a spinner in place of the leading icon and blocks presses. */
  loading?: boolean;
  icon?: IconName;
  iconPosition?: "leading" | "trailing";
  style?: ViewStyle;
}

/**
 * Screen readers need a name for the control. String children supply it for free;
 * anything else (an icon, a composed node) must be labelled explicitly, so we fall
 * back to whatever the caller passed rather than announcing an unnamed button.
 */
const deriveLabel = (children: React.ReactNode, explicit?: string): string | undefined => {
  if (explicit) return explicit;
  const parts = Children.toArray(children).filter(
    (child): child is string | number => typeof child === "string" || typeof child === "number"
  );
  return parts.length ? parts.join(" ") : undefined;
};

export default function Button({
  children,
  disabled,
  variant = "primary",
  size = "lg",
  loading = false,
  icon,
  iconPosition = "leading",
  style,
  onPress,
  accessibilityLabel,
  ...props
}: ButtonProps) {
  const { colors, primaryColor } = useAppTheme();
  const sizeStyles = theme.buttonSizes[size];
  const isInert = Boolean(disabled) || loading;

  const tone = variant === "danger" ? theme.colors.error : primaryColor;
  const filled = variant === "primary" || variant === "danger";
  const contentColor = isInert ? colors.muted : filled ? theme.colors.white : tone;

  const surfaceStyle: ViewStyle = filled
    ? { backgroundColor: isInert ? colors.disabled : tone }
    : variant === "secondary"
      ? { borderWidth: 1, borderColor: isInert ? colors.disabled : tone }
      : {};

  const handlePress: PressableProps["onPress"] = (e) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  const glyphSize = size === "sm" ? "sm" : "lg";

  return (
    <Pressable
      style={(state) => [
        styles.button,
        sizeStyles,
        surfaceStyle,
        /* istanbul ignore next */
        (state as { hovered?: boolean }).hovered && !isInert && styles.hovered,
        style,
      ]}
      disabled={isInert}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={deriveLabel(children, accessibilityLabel)}
      accessibilityState={{ disabled: isInert, busy: loading }}
      aria-busy={loading}
      {...props}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={contentColor} />
        ) : icon && iconPosition === "leading" ? (
          <Icon name={icon} size={glyphSize} color={contentColor} />
        ) : null}
        <ThemedText style={[styles.buttonText, { color: contentColor }]}>{children}</ThemedText>
        {!loading && icon && iconPosition === "trailing" ? (
          <Icon name={icon} size={glyphSize} color={contentColor} />
        ) : null}
      </View>
    </Pressable>
  );
}
