import { type StyleProp, type ViewStyle } from "react-native";
import { IconButton } from "@/components/common/IconButton";
import { type IconName } from "@/components/common/Icon";

export interface RowIconButtonProps {
  name: IconName;
  onPress?: () => void;
  color: string;
  testID?: string;
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Row-level action button for the settings cards — edit, delete, combine, move.
 */
export function RowIconButton({ size = 16, ...props }: RowIconButtonProps) {
  return <IconButton compact size={size} {...props} />;
}
