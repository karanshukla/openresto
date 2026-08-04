import { type ComponentProps } from "react";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";

export interface RowTextButtonProps {
  label: string;
  onPress?: () => void;
  color: string;
  testID?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  /** Optional leading Ionicons glyph rendered before the label. */
  icon?: ComponentProps<typeof Ionicons>["name"];
  style?: StyleProp<ViewStyle>;
}

/**
 * Small bordered text-pill button that pairs visually with {@link RowIconButton} in a row's trailing
 * action cluster. Used for the primary, non-destructive "Edit" affordance so it reads as a real
 * button (the user asked for a proper Edit button instead of a bare pencil icon), while destructive
 * actions (delete) stay icon-only. Matches RowIconButton's tappable target and the shared 8px radius
 * so the cluster stays tight and consistent.
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
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          paddingVertical: 4,
          paddingHorizontal: 8,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: color,
          opacity: disabled ? 0.5 : pressed ? 0.6 : 1,
        },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={13} color={color} /> : null}
      <ThemedText style={{ fontSize: 12, fontWeight: "600", color }}>{label}</ThemedText>
    </Pressable>
  );
}
