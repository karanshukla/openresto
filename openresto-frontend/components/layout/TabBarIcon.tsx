import { Platform } from "react-native";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { Icon, resolveIconSize, type IconName } from "@/components/common/Icon";

export interface TabBarIconProps {
  /** Ionicons glyph, used on Android and web where SF Symbols are not Apple's to license. */
  name: IconName;
  /** The matching SF Symbol, used on iOS so the bar reads as the system's own. */
  symbol: SFSymbol;
  color: string;
  /** Filled on the selected tab, outlined otherwise — the convention both platforms share. */
  selected: boolean;
}

const SIZE = resolveIconSize("md");

/**
 * One tab's glyph, in whichever icon set the platform actually uses. Ionicons on an iOS tab bar
 * is one of the tells the bar is not the system's; SF Symbols cannot be shipped off Apple's
 * platforms, so the two sets sit behind this rather than at every call site.
 *
 * @see [TabBarIcon.test.tsx](../../tests/components/layout/TabBarIcon.test.tsx) — pins that iOS
 * draws the symbol and every other platform the Ionicon, and that neither reaches assistive
 * tech, which reads the tab's own label instead.
 */
export function TabBarIcon({ name, symbol, color, selected }: TabBarIconProps) {
  if (Platform.OS === "ios") {
    return (
      <SymbolView
        testID="tab-bar-symbol"
        name={symbol}
        size={SIZE}
        tintColor={color}
        // The glyph duplicates the label beneath it, so it stays out of the a11y tree.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        // Falls back to the Ionicon on a device whose OS predates the symbol.
        fallback={<Icon name={name} size="md" color={color} />}
        weight={selected ? "semibold" : "regular"}
      />
    );
  }

  return <Icon name={name} size="md" color={color} />;
}

export default TabBarIcon;
