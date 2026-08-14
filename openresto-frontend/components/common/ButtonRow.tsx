import { View, type StyleProp, type ViewStyle } from "react-native";
import { styles } from "./ButtonRow.styles";

export type ButtonRowAlign = "end" | "start" | "between";

export interface ButtonRowProps {
  children: React.ReactNode;
  /**
   * `end` (default) is the action cluster that closes a form or a confirmation — the primary
   * button sits last, nearest the edge the eye finishes on. `start` is for a standing CTA that
   * opens something ("Add user"). `between` pairs a status line with its action.
   */
  align?: ButtonRowAlign;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The one way an admin screen groups buttons: a wrapping row whose buttons keep their natural
 * width. Wrapping rather than a viewport breakpoint is what makes it safe inside a card of any
 * width — a cluster too wide for its container drops to a second line with every button still
 * at full height, instead of one button stretching and its neighbour shrinking.
 *
 * Source order is reading order: destructive or dismissing actions first, the primary last.
 */
export function ButtonRow({ children, align = "end", style, testID }: ButtonRowProps) {
  return (
    <View
      testID={testID}
      style={[
        styles.row,
        align === "start" && styles.start,
        align === "between" && styles.between,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export default ButtonRow;
