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
import GuestTabBar from "@/components/layout/GuestTabBar";
import RouteTransition from "@/components/layout/RouteTransition";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { focusTarget } from "@/utils/focusRegistry";
import KeyboardShortcutsHelp from "@/components/common/KeyboardShortcutsHelp";
import { useBrand } from "@/context/BrandContext";
import { useAppTheme } from "@/hooks/use-app-theme";

/**
 * The header's hairline (iOS) / elevation (Android) lands straight on the top border of the
 * first card every guest screen renders, reading as a double rule. `largeTitleHeader` turns
 * off the same line in the expanded large-title state.
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
 * A large title belongs to a screen a guest lands on, never to one pushed on top of it, where
 * it stacks a second bar under the back button it shares a row with.
 *
 * `headerTransparent: false` is load-bearing rather than a default restated: enabling a large
 * title makes the iOS header translucent, and the guest scroll views don't set
 * `contentInsetAdjustmentBehavior="automatic"`, so their first row would sit under the bar.
 *
 * @see [layout.test.tsx](<../../tests/app/(user)/layout.test.tsx>) — pins the boundary: the
 * top-level list screens carry a large title, the detail screens pushed on top do not.
 */
function largeTitleHeader(): NativeStackNavigationOptions {
  return Platform.OS === "ios"
    ? {
        headerLargeTitleEnabled: true,
        headerLargeTitleShadowVisible: false,
        headerTransparent: false,
      }
    : {};
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

  // Language and theme live in the navbar's overflow menu, which is web-only, so the native
  // header carries the one control that opens both.
  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <Stack
        screenOptions={{
          ...guestHeader(),
          headerRight: () => <GuestSettingsMenu color={colors.muted} />,
        }}
      >
        <Stack.Screen name="index" options={{ title: brand.appName, headerShown: false }} />
        {/* /search is a legacy web URL that only renders a <Redirect>, so a native header
            would flash a bar titled after the filename on the way through. */}
        <Stack.Screen name="search" options={{ headerShown: false }} />
        <Stack.Screen
          name="locations/index"
          options={{ ...largeTitleHeader(), title: t("restaurant.locationsScreen.routeTitle") }}
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
        <Stack.Screen
          name="booking-confirmation/[bookingRef]"
          options={{ title: t("booking.result.routeTitleConfirmed"), headerBackVisible: false }}
        />
        <Stack.Screen
          name="lookup"
          options={{ ...largeTitleHeader(), title: t("lookup.routeTitle") }}
        />
      </Stack>
      <GuestTabBar />
    </View>
  );
}
