import { Platform, View } from "react-native";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/hooks/use-app-theme";
import GuestSettingsMenu from "./GuestSettingsMenu";
import { SETTINGS_ANCHOR_EDGE, styles } from "./GuestSettingsAnchor.styles";

/** The routes that draw with no native header, so nothing above them carries the control. */
const TAB_ROOTS = ["/", "/locations", "/lookup"];

/**
 * Exact, not prefix: `/locations/[id]` is pushed over the root and keeps its header, which
 * carries the control already. The tab bar's own matching is deliberately the looser question
 * — which tab a pushed screen belongs to — and the two must not be collapsed into one.
 */
export function isGuestTabRoot(pathname: string): boolean {
  return TAB_ROOTS.includes(pathname);
}

/**
 * The settings control on the three header-less tab roots, pinned outside their scroll views.
 *
 * Each root used to carry its own copy inside the page — the home hero's corner, the other
 * two inside `ScreenHeading` — which scrolled away with the content, leaving a diner partway
 * down a list with no way to language, theme or About. Its counterpart on a pushed screen is
 * the stack's `headerRight`, which is already pinned, so this is the same control in the same
 * place for every guest route.
 *
 * An opaque chip rather than the hero's white-on-scrim treatment: the same control now sits
 * over a header photo and over plain page content as the root scrolls, and only a filled
 * surface reads against both.
 *
 * @see [GuestSettingsAnchor.test.tsx](../../tests/components/layout/GuestSettingsAnchor.test.tsx)
 * — pins that it renders on a root, not on a screen pushed over one, and never on web.
 */
export default function GuestSettingsAnchor() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  if (Platform.OS === "web" || !isGuestTabRoot(pathname)) return null;

  return (
    <View
      testID="guest-settings-anchor"
      pointerEvents="box-none"
      style={[styles.anchor, { top: insets.top, right: insets.right + SETTINGS_ANCHOR_EDGE }]}
    >
      <GuestSettingsMenu
        color={colors.muted}
        backgroundColor={colors.card}
        variant="tinted"
        style={[styles.chip, { borderColor: colors.border }]}
        testID="guest-settings-anchor-open"
      />
    </View>
  );
}
