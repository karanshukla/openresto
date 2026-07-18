import { useState } from "react";
import { Platform, View } from "react-native";
import { Slot, Stack, useRouter, useSegments } from "expo-router";
import Navbar from "@/components/layout/Navbar";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { focusTarget } from "@/utils/focusRegistry";
import KeyboardShortcutsHelp from "@/components/common/KeyboardShortcutsHelp";
import { useBrand } from "@/context/BrandContext";

export default function UserLayout() {
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

  // On web: show the same top navbar, let browser handle back navigation.
  // On native: use the Stack for native back-swipe and header.
  /* istanbul ignore next */
  if (Platform.OS === "web") {
    return (
      <View style={{ flex: 1 }}>
        <Navbar onOpenShortcuts={() => setShowShortcutsHelp(true)} />
        <Slot />
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
      <Stack.Screen name="locations/index" options={{ title: "Locations" }} />
      <Stack.Screen name="locations/[id]" options={{ title: "Locations" }} />
      <Stack.Screen name="restaurant/[id]" options={{ title: "Restaurant" }} />
      <Stack.Screen name="book" options={{ title: "Book a Table" }} />
      <Stack.Screen
        name="booking-confirmation/[bookingId]"
        options={{ title: "Booking Confirmed", headerBackVisible: false }}
      />
      <Stack.Screen name="lookup" options={{ title: "Find My Booking" }} />
    </Stack>
  );
}
