import { Platform, Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import type { SFSymbol } from "expo-symbols";
import * as Haptics from "expo-haptics";
import { usePathname, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { type IconName } from "@/components/common/Icon";
import { TabBarIcon } from "@/components/layout/TabBarIcon";
import { styles } from "./GuestTabBar.styles";

interface Tab {
  href: Href;
  /** Matched against the pathname; `/` has to be exact or every route would look active. */
  match: (pathname: string) => boolean;
  icon: IconName;
  activeIcon: IconName;
  /** The iOS glyph. Outlined and filled are one symbol there, varied by weight and fill. */
  symbol: SFSymbol;
  activeSymbol: SFSymbol;
  label: string;
}

/**
 * The guest app's primary navigation off web. `Navbar` — which owns the Locations and My
 * booking links on web — never renders on native, so without this the two screens exist as
 * routes nothing in the app can reach.
 *
 * @see [GuestTabBar.test.tsx](../../tests/components/layout/GuestTabBar.test.tsx) — pins that
 * only the exact home path marks Home active, that a nested location route keeps Locations
 * selected, and that a booking confirmation keeps My booking selected.
 */
export default function GuestTabBar() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors, primaryColor, isDark } = useAppTheme();
  /**
   * iOS tab bars are translucent and let the list scroll under them; Android's Material 3 bar
   * is an opaque surface with a pill behind the selected icon. Doing either on the other
   * platform is what makes a hand-drawn bar read as hand-drawn (#426).
   */
  const translucent = Platform.OS === "ios";

  const tabs: Tab[] = [
    {
      href: "/",
      match: (p) => p === "/",
      icon: "home-outline",
      activeIcon: "home",
      symbol: "house",
      activeSymbol: "house.fill",
      label: t("common.tabs.home"),
    },
    {
      href: "/locations",
      match: (p) => p.startsWith("/locations"),
      icon: "location-outline",
      activeIcon: "location",
      symbol: "mappin.and.ellipse",
      activeSymbol: "mappin.circle.fill",
      label: t("common.navbar.locationsLink"),
    },
    {
      href: "/lookup",
      // A just-made booking is one of the diner's bookings, and /booking-confirmation is
      // literally LookupScreen with the ref prefilled. Leaving the tab unlit there was the
      // one guest route that answered "where am I" with nothing.
      match: (p) => p.startsWith("/lookup") || p.startsWith("/booking-confirmation"),
      icon: "ticket-outline",
      activeIcon: "ticket",
      symbol: "ticket",
      activeSymbol: "ticket.fill",
      label: t("common.navbar.myBookingsLink"),
    },
  ];

  return (
    <ThemedView
      testID="guest-tab-bar"
      accessibilityRole="tablist"
      style={[
        styles.bar,
        // The card surface, not the page: a bar the same colour as the list it sits under
        // has only its hairline to say where the list ends. Transparent where the blur
        // beneath is what paints it.
        {
          backgroundColor: translucent ? "transparent" : colors.card,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {translucent && (
        <BlurView
          testID="guest-tab-bar-blur"
          intensity={80}
          tint={isDark ? "systemChromeMaterialDark" : "systemChromeMaterialLight"}
          style={StyleSheet.absoluteFill}
        />
      )}
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        const color = active ? primaryColor : colors.muted;
        return (
          <Pressable
            key={String(tab.href)}
            testID={`guest-tab-${String(tab.href)}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
            style={styles.tab}
            onPress={() => {
              Haptics.selectionAsync();
              router.navigate(tab.href);
            }}
          >
            {/* Material 3 marks the selected destination with a pill behind its icon; iOS
                marks it with the tint alone, so the pill is drawn only where it belongs. */}
            <View
              testID={active ? "guest-tab-indicator" : undefined}
              style={[
                styles.indicator,
                active && !translucent && { backgroundColor: `${primaryColor}1f` },
              ]}
            >
              <TabBarIcon
                name={active ? tab.activeIcon : tab.icon}
                symbol={active ? tab.activeSymbol : tab.symbol}
                color={color}
                selected={active}
              />
            </View>
            <ThemedText style={[styles.label, { color }]}>{tab.label}</ThemedText>
          </Pressable>
        );
      })}
    </ThemedView>
  );
}
