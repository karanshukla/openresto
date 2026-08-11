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
 * Small bordered text-pill that pairs with {@link RowIconButton} in a row's trailing action
 * cluster. Used for the primary, non-destructive "Edit" affordance so it reads as a real button,
 * while destructive actions stay icon-only.
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
