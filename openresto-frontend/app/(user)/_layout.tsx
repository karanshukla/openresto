import { useState } from "react";
import { Platform, View } from "react-native";
import { Slot, Stack, useRouter, useSegments } from "expo-router";
import { useTranslation } from "react-i18next";
import Navbar from "@/components/layout/Navbar";
import RouteTransition from "@/components/layout/RouteTransition";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { focusTarget } from "@/utils/focusRegistry";
import KeyboardShortcutsHelp from "@/components/common/KeyboardShortcutsHelp";
import { useBrand } from "@/context/BrandContext";

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

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: brand.appName, headerShown: false }} />
      <Stack.Screen
        name="locations/index"
        options={{ title: t("restaurant.locationsScreen.routeTitle") }}
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
      <Stack.Screen name="lookup" options={{ title: t("lookup.routeTitle") }} />
    </Stack>
  );
}
