import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import { Icon, resolveIconSize, type IconName, type IconSize } from "@/components/common/Icon";
import { theme } from "@/theme/theme";
import { styles } from "./IconButton.styles";

export type IconButtonVariant = "plain" | "tinted" | "outlined";

export interface IconButtonProps {
  name: IconName;
  /**
   * Required. An icon-only control has no text for a screen reader to announce,
   * so without this the button is literally unnamed — WCAG 4.1.2.
   */
  accessibilityLabel: string;
  onPress?: () => void;
  color: string;
  /** Background for `tinted`, border for `outlined`. Ignored by `plain`. */
  backgroundColor?: string;
  size?: IconSize | number;
  variant?: IconButtonVariant;
  disabled?: boolean;
  accessibilityHint?: string;
  /** Set when the button toggles something, so state is announced alongside the name. */
  selected?: boolean;
  /** Tighter chrome for dense action clusters; the touch target is preserved via hitSlop. */
  compact?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Icon-only button. Small glyphs keep their compact chrome and reach the WCAG 2.5.5
 * 44px target through hitSlop rather than by inflating the layout, so dense action
 * clusters stay dense while remaining tappable.
 */
export function IconButton({
  name,
  accessibilityLabel,
  onPress,
  color,
  backgroundColor,
  size = "lg",
  variant = "plain",
  disabled = false,
  accessibilityHint,
  selected,
  compact = false,
  testID,
  style,
}: IconButtonProps) {
  const padding = compact ? theme.spacing.xxs : theme.spacing.xsm;
  const rendered = resolveIconSize(size) + padding * 2;
  const slop = Math.max(0, Math.ceil((theme.a11y.minTouchTarget - rendered) / 2));

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, ...(selected === undefined ? {} : { selected }) }}
      hitSlop={{ top: slop, bottom: slop, left: slop, right: slop }}
      style={({ pressed }) => [
        styles.base,
        { padding },
        variant === "tinted" && { backgroundColor },
        variant === "outlined" && { borderWidth: 1, borderColor: backgroundColor ?? color },
        disabled ? styles.disabled : pressed && styles.pressed,
        style,
      ]}
    >
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

export default IconButton;
