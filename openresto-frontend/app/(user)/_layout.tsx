import { useState } from "react";
import { Platform, View } from "react-native";
import {
  Slot,
  Stack,
  useRouter,
  useSegments,
  type NativeStackNavigationOptions,
} from "expo-router";
import { useTranslation } from "react-i18next";
import Navbar from "@/components/layout/Navbar";
import OfflineBanner from "@/components/layout/OfflineBanner";
import GuestSettingsMenu from "@/components/layout/GuestSettingsMenu";
import GuestSettingsAnchor from "@/components/layout/GuestSettingsAnchor";
import GuestTabBar from "@/components/layout/GuestTabBar";
import RouteTransition from "@/components/layout/RouteTransition";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { focusTarget } from "@/utils/focusRegistry";
import KeyboardShortcutsHelp from "@/components/common/KeyboardShortcutsHelp";
import { useBrand } from "@/context/BrandContext";
import { useAppTheme } from "@/hooks/use-app-theme";

/**
 * The header's hairline (iOS) / elevation (Android) lands straight on the top border of the
 * first card every guest screen renders, reading as a double rule.
 *
 * `headerBackButtonDisplayMode` is iOS-only (`ScreenStackHeaderConfigProps`) — Android's back
 * affordance is already a bare arrow with no previous-screen title to crowd it.
 *
 * @see [layout.test.tsx](<../../tests/app/(user)/layout.test.tsx>) — pins that the minimal
 * back button reaches the header on iOS and is left off Android.
 */
function guestHeader(): NativeStackNavigationOptions {
  return {
    headerShadowVisible: false,
    ...(Platform.OS === "ios" ? { headerBackButtonDisplayMode: "minimal" as const } : {}),
  };
}

/**
 * The three tab roots — and the booking confirmation, which is the lookup root with a ref
 * prefilled — draw with no native header, the way the home screen always has: the tab bar is
 * the way between them, so a back arrow on one is a second navigation model laid over the
 * first and reads as a website in a wrapper. Each root carries its own title through
 * `ScreenHeading` and the settings control through `GuestSettingsAnchor`, and the roots are
 * not swipeable back to one another. The screens pushed over a root keep the header, since its
 * back arrow is what drives the swipe-back gesture and what the Android system back mirrors.
 *
 * @see [layout.test.tsx](<../../tests/app/(user)/layout.test.tsx>) — pins the boundary: the
 * tab roots have no header, the detail screens pushed on top keep theirs.
 */
function tabRoot(): NativeStackNavigationOptions {
  return { headerShown: false, gestureEnabled: false };
}

export default function UserLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  const brand = useBrand();
  const segments = useSegments();
  // useSegments() reflects the true current URL rather than a focus-event
  // lifecycle. useIsFocused() never fires on a cold web load (page.goto()
  // straight to a route dispatches no "focus" nav event), which left
  // shortcuts stuck disabled for any session that didn't arrive via in-app
  // navigation — see the matching comment in app/admin/_layout.tsx.
  const isUserRouteActive = segments[0] === "(user)";
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const { colors } = useAppTheme();

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

  // Language and theme live in the navbar's overflow menu, which is web-only, so off web the
  // header of every pushed screen carries the one control that opens both; on the header-less
  // tab roots `GuestSettingsAnchor` pins the same control over the stack instead.
  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <Stack
        screenOptions={{
          ...guestHeader(),
          headerRight: () => <GuestSettingsMenu color={colors.muted} />,
        }}
      >
        <Stack.Screen name="index" options={{ ...tabRoot(), title: brand.appName }} />
        {/* /search is a legacy web URL that only renders a <Redirect>, so a native header
            would flash a bar titled after the filename on the way through. */}
        <Stack.Screen name="search" options={{ headerShown: false }} />
        <Stack.Screen
          name="locations/index"
          options={{ ...tabRoot(), title: t("restaurant.locationsScreen.routeTitle") }}
        />
        <Stack.Screen
          name="locations/[id]"
          options={{ title: t("restaurant.locationsScreen.routeTitle") }}
        />
        <Stack.Screen
          name="restaurant/[id]"
          options={{ title: t("restaurant.details.routeTitle") }}
        />
        <Stack.Screen name="book" options={{ title: t("booking.form.routeTitle") }} />
        {/* Not a screen of its own: it is LookupScreen with the ref prefilled, so it draws
            the way /lookup does rather than as a detail pushed over the booking form. There
            is nowhere to go back to — the form would re-offer a table already booked. */}
        <Stack.Screen
          name="booking-confirmation/[bookingRef]"
          options={{ ...tabRoot(), title: t("booking.result.routeTitleConfirmed") }}
        />
        <Stack.Screen name="lookup" options={{ ...tabRoot(), title: t("lookup.routeTitle") }} />
      </Stack>
      <GuestSettingsAnchor />
      <GuestTabBar />
    </View>
  );
}
