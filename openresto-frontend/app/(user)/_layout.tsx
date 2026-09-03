import { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { useTranslation } from "react-i18next";
import Navbar from "@/components/layout/Navbar";
import OfflineBanner from "@/components/layout/OfflineBanner";
import GuestTabs from "@/components/layout/GuestTabs";
import RouteTransition from "@/components/layout/RouteTransition";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { focusTarget } from "@/utils/focusRegistry";
import KeyboardShortcutsHelp from "@/components/common/KeyboardShortcutsHelp";
import { registerQuickActions } from "@/services/quickActions";

/**
 * The guest surface. Its routes sit in three groups — `(home)`, `(locations)`, `(bookings)` —
 * one per tab of the native tab bar, each holding its own stack (`GuestTabStack`). The group a
 * route file lives in is what decides which tab stays selected on it, so
 * `booking-confirmation/[bookingRef]` is in `(bookings)`: a just-made booking is one of the
 * diner's bookings, and the confirmation is the lookup screen with the reference prefilled.
 * Groups add nothing to the URL, so the web build keeps every public path it had.
 *
 * @see [tab-layouts.test.tsx](<../../tests/app/(user)/tab-layouts.test.tsx>) — pins which
 * routes each tab holds and that the confirmation belongs to the bookings tab.
 */
export default function UserLayout() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const segments = useSegments();
  // useSegments() reflects the true current URL rather than a focus-event
  // lifecycle. useIsFocused() never fires on a cold web load (page.goto()
  // straight to a route dispatches no "focus" nav event), which left
  // shortcuts stuck disabled for any session that didn't arrive via in-app
  // navigation — see the matching comment in app/admin/_layout.tsx.
  const isUserRouteActive = segments[0] === "(user)";
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  /**
   * Long-pressing the app icon offers the one destination a returning guest wants (#431).
   * Inert on web, where there is no icon to press. Keyed on the language rather than on `t`
   * so the label is rewritten when the guest switches locale and not on every render.
   */
  useEffect(
    () =>
      registerQuickActions({
        title: t("common.navbar.myBookingsLink"),
        onSelect: () => router.push("/lookup"),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n.language]
  );

  useKeyboardShortcuts(
    isUserRouteActive
      ? {
          l: () => {
            router.push("/lookup");
            focusTarget("user-lookup");
          },
          "?": () => setShowShortcutsHelp((v) => !v),
        }
      : {}
  );

  /* istanbul ignore next */
  if (Platform.OS === "web") {
    return (
      <View style={{ flex: 1 }}>
        <OfflineBanner />
        <Navbar onOpenShortcuts={() => setShowShortcutsHelp(true)} />
        <RouteTransition>
          <Slot />
        </RouteTransition>
        <KeyboardShortcutsHelp
          visible={showShortcutsHelp}
          scope="user"
          onClose={() => setShowShortcutsHelp(false)}
        />
      </View>
    );
  }

  return <GuestTabs />;
}
