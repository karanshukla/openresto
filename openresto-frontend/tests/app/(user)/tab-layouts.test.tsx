import React from "react";
import fs from "fs";
import path from "path";
import { render } from "@testing-library/react-native";
import { Platform } from "react-native";

// Populated by the Stack mocks below. Named with the `mock` prefix so the jest.mock
// factory is allowed to close over them.
const mockScreenOptions: Record<string, unknown>[] = [];
const mockScreens: { name: string; options: Record<string, unknown> }[] = [];

// GuestTabStack nests its own provider and the chrome inside it reads insets; both are stubbed
// so these tests are about which routes each tab holds and nothing about geometry.
jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  return {
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
}));

jest.mock("@/api/restaurants", () => ({ fetchSocialLinks: jest.fn().mockResolvedValue([]) }));

jest.mock("expo-router", () => {
  const React = require("react");
  const Stack = ({
    screenOptions,
    children,
  }: {
    screenOptions?: Record<string, unknown>;
    children?: React.ReactNode;
  }) => {
    mockScreenOptions.push(screenOptions ?? {});
    return React.createElement(React.Fragment, null, children);
  };
  Stack.Screen = ({ name, options }: { name: string; options?: Record<string, unknown> }) => {
    mockScreens.push({ name, options: options ?? {} });
    return null;
  };
  return { Slot: () => null, Stack, usePathname: () => "/" };
});

const USER_DIR = path.join(process.cwd(), "app", "(user)");
type Group = "(home)" | "(locations)" | "(bookings)";
const GROUPS: Group[] = ["(home)", "(locations)", "(bookings)"];

const layoutOf = (group: Group) =>
  require(`@/app/(user)/${group}/_layout`) as {
    default: React.ComponentType;
    unstable_settings?: { initialRouteName?: string };
  };

const originalOS = Platform.OS;

/** The `<Stack>` is the native branch; on web every group passes its routes through a `<Slot>`. */
function renderGroup(group: Group, os: "ios" | "android" = "ios") {
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
  mockScreenOptions.length = 0;
  mockScreens.length = 0;

  const layout = layoutOf(group);
  render(React.createElement(layout.default));

  return {
    settings: layout.unstable_settings,
    screens: mockScreens.map((screen) => screen.name),
    optionsFor: (name: string) => mockScreens.find((screen) => screen.name === name)?.options,
  };
}

const routeExists = (group: Group, name: string) => {
  const base = path.join(USER_DIR, group, name);
  return fs.existsSync(`${base}.tsx`) || fs.existsSync(path.join(base, "index.tsx"));
};

afterEach(() => {
  Object.defineProperty(Platform, "OS", { value: originalOS, configurable: true });
});

/**
 * Issue #426. Off web the guest routes sit under a native tab bar, and a tabs navigator cannot
 * host a pushed screen: every route has to live inside the group of the tab it belongs to, or
 * it is unreachable. The group is therefore what decides which tab a route lights up.
 */
describe("the guest route groups", () => {
  it("are the three tabs and nothing else, so no route sits outside a tab", () => {
    expect(fs.readdirSync(USER_DIR).sort()).toEqual([...GROUPS, "_layout.tsx"].sort());
  });

  it.each(GROUPS)("%s registers only routes that exist on disk under it", (group) => {
    // Expo Router matches a <Stack.Screen name> against the route filename. A name that
    // matches nothing silently drops that screen's options — which is how a stale
    // "booking-confirmation/[bookingId]" once left the confirmation without its title or its
    // suppressed back button — so the check is against the filesystem, not a hardcoded list.
    const { screens } = renderGroup(group);

    expect(screens.length).toBeGreaterThan(0);
    expect(screens.filter((name) => !routeExists(group, name))).toEqual([]);
  });
});

describe("the Home tab", () => {
  it("draws the home root with no header and no swipe back, titled after the brand", () => {
    const { optionsFor } = renderGroup("(home)");

    expect(optionsFor("index")).toMatchObject({
      headerShown: false,
      gestureEnabled: false,
      title: "Open Resto",
    });
  });

  it("keeps the legacy /search redirect out of the native header", () => {
    const { optionsFor } = renderGroup("(home)");

    expect(optionsFor("search")).toMatchObject({ headerShown: false });
  });

  // `index` sorts first on its own, and a root put under /search would be doubled the moment
  // the redirect replaced it.
  it("names no initial route", () => {
    expect(renderGroup("(home)").settings).toBeUndefined();
  });
});

describe("the Locations tab", () => {
  // By route order `book` sorts ahead of `locations/index`, so without an explicit root the
  // tab would mount on a redirect shim and send itself home before it was ever opened.
  it("opens on the list rather than on a redirect shim", () => {
    expect(renderGroup("(locations)").settings).toEqual({ initialRouteName: "locations/index" });
  });

  // The pair is the rule: the tab bar is the way between the roots, so a root draws no header
  // and no back arrow, while a screen pushed over one keeps the header whose arrow drives the
  // swipe-back gesture.
  it("draws the list root with no header and keeps the header on the pushed location", () => {
    const { optionsFor } = renderGroup("(locations)");

    expect(optionsFor("locations/index")).toMatchObject({
      headerShown: false,
      gestureEnabled: false,
    });
    expect(optionsFor("locations/[id]")).not.toHaveProperty("headerShown");
    expect(optionsFor("locations/[id]")).not.toHaveProperty("gestureEnabled");
  });

  // Every legacy URL that resolves to a location redirects inside this tab, so the redirect
  // never has to cross to another one.
  it.each(["book", "book/[restaurantId]", "restaurant/[id]"])(
    "holds the %s redirect shim, which resolves to a location",
    (shim) => {
      expect(routeExists("(locations)", shim)).toBe(true);
    }
  );

  it("holds on Android too, where the system back covers the roots", () => {
    const { optionsFor } = renderGroup("(locations)", "android");

    expect(optionsFor("locations/index")).toMatchObject({ headerShown: false });
  });
});

describe("the My booking tab", () => {
  it("draws the lookup root with no header and no swipe back", () => {
    const { optionsFor } = renderGroup("(bookings)");

    expect(optionsFor("lookup")).toMatchObject({ headerShown: false, gestureEnabled: false });
  });

  // A just-made booking is one of the diner's bookings, and /booking-confirmation is
  // literally LookupScreen with the ref prefilled. It lives in this group and no other, which
  // is what keeps My booking selected on it rather than answering "where am I" with nothing.
  it("holds the booking confirmation, so the tab stays selected on it", () => {
    expect(routeExists("(bookings)", "booking-confirmation/[bookingRef]")).toBe(true);
    expect(routeExists("(home)", "booking-confirmation/[bookingRef]")).toBe(false);
    expect(routeExists("(locations)", "booking-confirmation/[bookingRef]")).toBe(false);
  });

  it("draws the confirmation the way its own lookup root draws", () => {
    const { optionsFor } = renderGroup("(bookings)");

    expect(optionsFor("booking-confirmation/[bookingRef]")).toMatchObject({
      headerShown: false,
      gestureEnabled: false,
    });
  });

  // A confirmation link opened cold then sits over the lookup root the same way an in-app
  // booking's does, so the system back lands in the same place either way.
  it("puts the lookup root under a cold confirmation link", () => {
    expect(renderGroup("(bookings)").settings).toEqual({ initialRouteName: "lookup" });
  });

  it("holds on Android too", () => {
    const { optionsFor } = renderGroup("(bookings)", "android");

    expect(optionsFor("lookup")).toMatchObject({ headerShown: false });
  });
});
