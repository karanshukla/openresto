import { Platform, View } from "react-native";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/hooks/use-app-theme";
import GuestSettingsMenu from "./GuestSettingsMenu";
import { SETTINGS_ANCHOR_EDGE, styles } from "./GuestSettingsAnchor.styles";

/** The tab roots, which draw with no native header. Exact: `/locations/[id]` is pushed over
 * one and keeps its header, which carries the control already. */
const TAB_ROOTS = ["/", "/locations", "/lookup"];

/**
 * Which routes have no header of their own to carry the control — the question `tabRoot()` in
 * `app/(user)/_layout.tsx` answers, asked from the other side. The booking confirmation is one
 * of them (it is the lookup root with a ref prefilled) and matches by prefix only because its
 * ref is a path segment; everything else is exact.
 *
 * `GuestTabBar` matches on its own, looser question — which tab a route belongs to — and the
 * two must not be collapsed into one.
 */
export function isHeaderlessGuestRoute(pathname: string): boolean {
  return TAB_ROOTS.includes(pathname) || pathname.startsWith("/booking-confirmation");
}

/**
 * The settings control on the guest routes that draw no native header, pinned outside their
 * scroll views.
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
 * — pins that it renders on every header-less route, the booking confirmation included,
 * not on a screen pushed under a header, and never on web.
 */
export default function GuestSettingsAnchor() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

  if (Platform.OS === "web" || !isHeaderlessGuestRoute(pathname)) return null;

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
