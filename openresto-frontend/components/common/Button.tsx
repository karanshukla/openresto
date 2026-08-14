import { Children } from "react";
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/themed-text";
import { Icon, type IconName } from "@/components/common/Icon";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./Button.styles";

/**
 * Weight, not colour: how much the button asks for the eye. `primary` is filled, `secondary`
 * is outlined, `ghost` is bare text. `danger` predates the `tone` axis and is kept as the
 * spelling for a filled destructive button.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/**
 * Colour, not weight: what the action means. Split from `variant` so an outlined destructive
 * button ("Remove image") and a filled one ("Yes, delete") are the same control at two weights
 * rather than two hand-rolled styles.
 */
export type ButtonTone = "brand" | "danger" | "warning" | "success" | "neutral";

export type ButtonSize = keyof typeof theme.buttonSizes;

interface ButtonProps extends Omit<PressableProps, "style" | "children"> {
  children: React.ReactNode;
  disabled?: boolean;
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  /** Renders a spinner in place of the leading icon and blocks presses. */
  loading?: boolean;
  icon?: IconName;
  iconPosition?: "leading" | "trailing";
  /** Stretches to the container. Reserve for a form's single submit button. */
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
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
  tone,
  size = "lg",
  loading = false,
  icon,
  iconPosition = "leading",
  fullWidth = false,
  style,
  onPress,
  accessibilityLabel,
  accessibilityState,
  ...props
}: ButtonProps) {
  const { colors, primaryColor } = useAppTheme();
  const sizeStyles = theme.buttonSizes[size];
  const isInert = Boolean(disabled) || loading;

  const weight = variant === "danger" ? "primary" : variant;
  const resolvedTone = tone ?? (variant === "danger" ? "danger" : "brand");

  const toneColors: Record<ButtonTone, string> = {
    brand: primaryColor,
    danger: theme.colors.error,
    warning: theme.colors.warning,
    success: theme.colors.success,
    neutral: colors.muted,
  };
  const toneColor = toneColors[resolvedTone];

  const filled = weight === "primary";
  const contentColor = isInert ? colors.muted : filled ? theme.colors.white : toneColor;

  const surfaceStyle: ViewStyle = filled
    ? { backgroundColor: isInert ? colors.disabled : toneColor }
    : weight === "secondary"
      ? { borderWidth: 1, borderColor: isInert ? colors.disabled : toneColor }
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
        fullWidth && styles.fullWidth,
        /* istanbul ignore next */
        (state as { hovered?: boolean }).hovered && !isInert && styles.hovered,
        style,
      ]}
      disabled={isInert}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={deriveLabel(children, accessibilityLabel)}
      accessibilityState={{ ...accessibilityState, disabled: isInert, busy: loading }}
      aria-busy={loading}
      {...props}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={contentColor} />
        ) : icon && iconPosition === "leading" ? (
          <Icon name={icon} size={glyphSize} color={contentColor} />
        ) : null}
        <ThemedText
          style={[styles.buttonText, size === "sm" && styles.buttonTextSm, { color: contentColor }]}
        >
          {children}
        </ThemedText>
        {!loading && icon && iconPosition === "trailing" ? (
          <Icon name={icon} size={glyphSize} color={contentColor} />
        ) : null}
      </View>
    </Pressable>
  );
}
