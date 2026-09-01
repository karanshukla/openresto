import { useState } from "react";
import { Platform, View } from "react-native";
import { Slot, Stack, useRouter, useSegments } from "expo-router";
import { useTranslation } from "react-i18next";
import Navbar from "@/components/layout/Navbar";
import OfflineBanner from "@/components/layout/OfflineBanner";
import GuestSettingsSheet from "@/components/layout/GuestSettingsSheet";
import RouteTransition from "@/components/layout/RouteTransition";
import { IconButton } from "@/components/common/IconButton";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { focusTarget } from "@/utils/focusRegistry";
import KeyboardShortcutsHelp from "@/components/common/KeyboardShortcutsHelp";
import { useBrand } from "@/context/BrandContext";
import { useAppTheme } from "@/hooks/use-app-theme";

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
  const [showSettings, setShowSettings] = useState(false);
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
          headerRight: () => (
            <IconButton
              name="settings-outline"
              accessibilityLabel={t("common.guestSettings.openLabel")}
              color={colors.muted}
              size="lg"
              onPress={() => setShowSettings(true)}
              testID="guest-settings-open"
            />
          ),
        }}
      >
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
      <GuestSettingsSheet visible={showSettings} onClose={() => setShowSettings(false)} />
    </View>
  );
}
