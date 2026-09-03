import { Platform } from "react-native";
import type { SFSymbol } from "expo-symbols";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconFamily, type IconName } from "@/components/common/Icon";

/** The route groups under `app/(user)/`, one per tab, each holding that tab's stack. */
export type GuestTabName = "(home)" | "(locations)" | "(bookings)";

export interface GuestTab {
  name: GuestTabName;
  label: string;
  /** Ionicons glyphs for Android, where SF Symbols are not Apple's to license. */
  icon: IconName;
  activeIcon: IconName;
  /** The iOS glyph pair, outlined at rest and filled when selected. */
  symbol: SFSymbol;
  activeSymbol: SFSymbol;
}

/** Material 3's selected-destination pill: the accent at 12% over the bar's own surface. */
const ANDROID_INDICATOR_ALPHA = "1f";

/**
 * The guest app's primary navigation off web: the platform's own tab bar, which is what gives
 * the translucent material and liquid glass on iOS, the Material 3 bar on Android, and
 * scroll-to-top plus pop-to-root on re-pressing the selected tab, none of which a hand-drawn row
 * of pressables could (#426). `Navbar` — which owns the Locations and My booking links on web —
 * never renders on native, so without this the two screens exist as routes nothing can reach.
 *
 * Which tab a route lights up is not decided here: each trigger names a route group, and a
 * route belongs to the tab whose group holds its file. The confirmation is `(bookings)`'s, so
 * My booking stays selected on it.
 *
 * @see [GuestTabs.test.tsx](../../tests/components/layout/GuestTabs.test.tsx) — pins the three
 * triggers and their glyph sets, that iOS keeps the system appearance and manages its own
 * content insets, and that Android gets the Material surface and leaves the insets to the bar.
 */
export default function GuestTabs() {
  const { t } = useTranslation();
  const { colors, primaryColor } = useAppTheme();

  const tabs: GuestTab[] = [
    {
      name: "(home)",
      label: t("common.tabs.home"),
      icon: "home-outline",
      activeIcon: "home",
      symbol: "house",
      activeSymbol: "house.fill",
    },
    {
      name: "(locations)",
      label: t("common.navbar.locationsLink"),
      icon: "location-outline",
      activeIcon: "location",
      symbol: "mappin.and.ellipse",
      activeSymbol: "mappin.circle.fill",
    },
    {
      name: "(bookings)",
      label: t("common.navbar.myBookingsLink"),
      icon: "ticket-outline",
      activeIcon: "ticket",
      symbol: "ticket",
      activeSymbol: "ticket.fill",
    },
  ];

  return (
    <NativeTabs
      tintColor={primaryColor}
      // iOS gets no surface colour, blur or label style: any of them replaces the system tab
      // bar appearance, and on iOS 26 that appearance is the liquid glass this exists for.
      {...(Platform.OS === "android"
        ? {
            backgroundColor: colors.card,
            indicatorColor: `${primaryColor}${ANDROID_INDICATOR_ALPHA}`,
          }
        : {})}
    >
      {tabs.map((tab) => (
        <NativeTabs.Trigger
          key={tab.name}
          name={tab.name}
          testID={`guest-tab-${tab.name}`}
          // iOS would otherwise switch the first scroll view it finds to automatic insets,
          // which double-pads a root that already pads the status bar itself and moves the
          // home hero out from under it. Android's bar is opaque and the platform lays the
          // content out above it, which is exactly what every root wants left alone.
          disableAutomaticContentInsets={Platform.OS === "ios"}
        >
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            sf={{ default: tab.symbol, selected: tab.activeSymbol }}
            src={{
              default: <NativeTabs.Trigger.VectorIcon family={IconFamily} name={tab.icon} />,
              selected: <NativeTabs.Trigger.VectorIcon family={IconFamily} name={tab.activeIcon} />,
            }}
          />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
