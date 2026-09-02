import { Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { usePathname, useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { Icon, type IconName } from "@/components/common/Icon";
import { styles } from "./GuestTabBar.styles";

interface Tab {
  href: Href;
  /** Matched against the pathname; `/` has to be exact or every route would look active. */
  match: (pathname: string) => boolean;
  icon: IconName;
  activeIcon: IconName;
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
  const { colors, primaryColor } = useAppTheme();

  const tabs: Tab[] = [
    {
      href: "/",
      match: (p) => p === "/",
      icon: "home-outline",
      activeIcon: "home",
      label: t("common.tabs.home"),
    },
    {
      href: "/locations",
      match: (p) => p.startsWith("/locations"),
      icon: "location-outline",
      activeIcon: "location",
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
        // has only its hairline to say where the list ends.
        {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom,
        },
      ]}
    >
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
            <Icon name={active ? tab.activeIcon : tab.icon} size="md" color={color} />
            <ThemedText style={[styles.label, { color }]}>{tab.label}</ThemedText>
          </Pressable>
        );
      })}
    </ThemedView>
  );
}
