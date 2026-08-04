import { type ComponentProps } from "react";
import { Pressable, type ViewStyle, type StyleProp } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface RowIconButtonProps {
  /** Ionicons glyph name. */
  name: ComponentProps<typeof Ionicons>["name"];
  onPress?: () => void;
  color: string;
  testID?: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
  /** Optional size override; defaults to 16 (the row-action icon convention). */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shared presentational icon button for the table/section settings cards. Wraps a bare
 * `<Ionicons>` in a consistent tappable target (`padding: 6`, rounded, generous `hitSlop`)
 * so every row-level action — edit, delete, combine, move — shares identical chrome.
 * Matches the inline `<Pressable style={{ padding: 6 }}>` pattern used by SocialLinkRow /
 * HighlightsCard, but de-duplicated so all three settings components stay in lockstep.
 */
export function RowIconButton({
  name,
  onPress,
  color,
  testID,
  accessibilityLabel,
  accessibilityHint,
  disabled = false,
  size = 16,
  style,
}: RowIconButtonProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[{ padding: 6, borderRadius: 8, opacity: disabled ? 0.5 : 1 }, style]}
    >
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}
