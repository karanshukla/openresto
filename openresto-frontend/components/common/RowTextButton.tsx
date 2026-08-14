import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Icon, type IconName } from "@/components/common/Icon";
import { theme } from "@/theme/theme";
import { styles } from "./RowTextButton.styles";

export interface RowTextButtonProps {
  label: string;
  onPress?: PressableProps["onPress"];
  color: string;
  testID?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  icon?: IconName;
  /**
   * For a row action that is also a state: the pill fills with `color` while on, and the state
   * is announced. Left undefined the button is a plain action and announces nothing extra.
   */
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Every row-level action in the admin, destructive ones included — the dense end of the button
 * scale, for the trailing cluster of a list row. The admin is used on tablets by staff who are
 * not in it daily, so an action carries its name rather than relying on a glyph the reader has
 * to decode; the 44px touch target comes from hitSlop so the row itself stays dense.
 *
 * Anything larger than a row action is a <Button size="md">, grouped by <ButtonRow>.
 */
export function RowTextButton({
  label,
  onPress,
  color,
  testID,
  accessibilityLabel,
  disabled = false,
  icon,
  selected,
  style,
}: RowTextButtonProps) {
  const contentColor = selected ? theme.colors.white : color;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled, ...(selected === undefined ? {} : { selected }) }}
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
      style={({ pressed }) => [
        styles.pill,
        { borderColor: color },
        selected && { backgroundColor: color },
        disabled ? styles.disabled : pressed && styles.pressed,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={13} color={contentColor} /> : null}
      <ThemedText style={[styles.label, { color: contentColor }]}>{label}</ThemedText>
    </Pressable>
  );
}

export default RowTextButton;
