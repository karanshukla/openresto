import type { ReactNode } from "react";
import { Platform, View } from "react-native";
import { Slot, Stack, type NativeStackNavigationOptions } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import OfflineBanner from "@/components/layout/OfflineBanner";
import GuestSettingsMenu from "@/components/layout/GuestSettingsMenu";
import GuestSettingsAnchor from "@/components/layout/GuestSettingsAnchor";
import { useAppTheme } from "@/hooks/use-app-theme";

/**
 * The header's hairline (iOS) / elevation (Android) lands straight on the top border of the
 * first card every guest screen renders, reading as a double rule.
 *
 * `headerBackButtonDisplayMode` and `headerLargeTitle` are both iOS-only
 * (`ScreenStackHeaderConfigProps`): Android's back affordance is already a bare arrow with no
 * previous-screen title to crowd it, and Material has no collapsing large title to ask for.
 * The large title only pays off where the screen's own ScrollView reports its offset to the
 * header — `contentInsetAdjustmentBehavior="automatic"` — which is why the screens that take
 * this header say so (`hasNativeHeader` on `LocationsScreen`) rather than assuming it.
 *
 * @see [GuestTabStack.test.tsx](../../tests/components/layout/GuestTabStack.test.tsx) — pins
 * that the minimal back button and the large title reach the header on iOS and are left off
 * Android.
 */
export function guestHeader(): NativeStackNavigationOptions {
  return {
    headerShadowVisible: false,
    ...(Platform.OS === "ios"
      ? {
          headerBackButtonDisplayMode: "minimal" as const,
          headerLargeTitle: true,
          headerLargeTitleShadowVisible: false,
        }
      : {}),
  };
}

/**
 * The three tab roots — and the booking confirmation, which is the lookup root with a ref
 * prefilled — draw with no native header: the tab bar is the way between them, so a back arrow
 * on one is a second navigation model laid over the first and reads as a website in a wrapper.
 * Each root carries its own title through `ScreenHeading` and the settings control through
 * `GuestSettingsAnchor`, and none is swipeable back to whatever sits under it. The screens
 * pushed over a root keep the header, since its back arrow is what drives the swipe-back
 * gesture and what the Android system back mirrors.
 *
 * @see [GuestTabStack.test.tsx](../../tests/components/layout/GuestTabStack.test.tsx) — pins
 * the boundary: a root has no header and no swipe back, a pushed screen keeps both.
 */
export function tabRoot(): NativeStackNavigationOptions {
  return { headerShown: false, gestureEnabled: false };
}

/**
 * One guest tab's own stack under the native tab bar (#426). Each of the three tabs is a route
 * group whose layout renders this around its `Stack.Screen`s, so a screen pushed inside a tab
 * keeps that tab selected and the web build sees the same routes it always did: on web this
 * passes the group's routes straight through, because the navbar is the way between the guest
 * screens there and nothing about that surface changes.
 *
 * Off web it is where the guest chrome lives — the offline strip, the header control on every
 * pushed screen, and the settings control pinned over the header-less roots, outside their
 * scroll views so it cannot scroll away with the page.
 *
 * The `SafeAreaProvider` is what makes `useSafeAreaInsets` inside a tab answer for the tab's
 * own content area rather than the window's. On iOS the content runs under the translucent bar,
 * so `insets.bottom` there is the bar's height, which a root's scroll content pads
 * (`useTabBarClearance`); on Android the platform lays the content out above its opaque bar and
 * the same call reports zero. Without it a root would either lose its last rows under the iOS
 * bar or pad an empty band above the Android one.
 *
 * @see [GuestTabStack.test.tsx](../../tests/components/layout/GuestTabStack.test.tsx) — pins
 * the web pass-through, the chrome off web, and the provider around the stack.
 */
export default function GuestTabStack({ children }: { children?: ReactNode }) {
  const { colors } = useAppTheme();

  if (Platform.OS === "web") return <Slot />;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>
        <OfflineBanner />
        <Stack
          screenOptions={{
            ...guestHeader(),
            headerRight: () => <GuestSettingsMenu color={colors.muted} />,
          }}
        >
          {children}
        </Stack>
        <GuestSettingsAnchor />
      </View>
    </SafeAreaProvider>
  );
}
