import { type ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/theme/theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];
export type IconSize = keyof typeof theme.iconSizes;

export interface IconProps {
  name: IconName;
  /** Named step on the icon scale, or a raw number for hero/empty-state art. */
  size?: IconSize | number;
  color?: string;
  /**
   * Screen readers skip icons by default — they nearly always sit inside a control or
   * next to text that already carries the meaning, so announcing them duplicates it.
   * Pass a label only when the glyph is the *sole* carrier of meaning.
   */
  label?: string;
  style?: ComponentProps<typeof Ionicons>["style"];
  testID?: string;
}

export const resolveIconSize = (size: IconSize | number = "md"): number =>
  typeof size === "number" ? size : theme.iconSizes[size];

export function Icon({ name, size = "md", color, label, style, testID }: IconProps) {
  const decorative = !label;

  return (
    <Ionicons
      name={name}
      size={resolveIconSize(size)}
      color={color}
      style={style}
      testID={testID}
      accessible={!decorative}
      accessibilityRole={decorative ? "none" : "image"}
      accessibilityLabel={label}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? "no-hide-descendants" : "yes"}
      aria-hidden={decorative}
    />
  );
}

export default Icon;
