import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Icon, type IconName } from "@/components/common/Icon";
import { styles } from "./RowTextButton.styles";

export interface RowTextButtonProps {
  label: string;
  onPress?: () => void;
  color: string;
  testID?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}

/**
 * Every row-level action in the admin, destructive ones included. The admin is used on
 * tablets by staff who are not in it daily, so an action carries its name rather than
 * relying on a glyph the reader has to decode.
 */
export function RowTextButton({
  label,
  onPress,
  color,
  testID,
  accessibilityLabel,
  disabled = false,
  icon,
  style,
}: RowTextButtonProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
      style={({ pressed }) => [
        styles.pill,
        { borderColor: color },
        disabled ? styles.disabled : pressed && styles.pressed,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={13} color={color} /> : null}
      <ThemedText style={[styles.label, { color }]}>{label}</ThemedText>
    </Pressable>
  );
}
