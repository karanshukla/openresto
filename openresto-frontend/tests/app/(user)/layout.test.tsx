import React from "react";
import { render } from "@testing-library/react-native";
import { Platform } from "react-native";

// Populated by the Stack mocks below. Named with the `mock` prefix so the jest.mock
// factory is allowed to close over them.
const mockScreenOptions: Record<string, unknown>[] = [];
const mockScreens: { name: string; options: Record<string, unknown> }[] = [];

// The layout's offline strip takes the top safe-area inset, and the hook throws outside a
// provider — the app mounts one in app/_layout.tsx, these tests render the layout alone.
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/context/BrandContext", () => {
  const brand = { primaryColor: "#0a7ea4", appName: "Open Resto" };
  return { useBrand: () => brand };
});

jest.mock("@/api/admin", () => ({
  getAdminOverview: jest.fn(),
}));

jest.mock("@/api/auth", () => ({
  verifyToken: jest.fn(),
}));

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
  return {
    Slot: () => null,
    Stack,
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
    usePathname: () => "/",
    useSegments: () => ["(user)"],
  };
});

jest.mock("@/components/layout/Navbar", () => ({
  __esModule: true,
  default: () => null,
}));

const originalOS = Platform.OS;

/** The `<Stack>` is the native branch; on web the layout returns a `<Slot>` instead. */
function renderOn(os: "ios" | "android") {
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
  mockScreenOptions.length = 0;
  mockScreens.length = 0;

  const { default: UserLayout } = require("@/app/(user)/_layout");
  render(<UserLayout />);

  return {
    screenOptions: mockScreenOptions[0],
    optionsFor: (name: string) => mockScreens.find((screen) => screen.name === name)?.options,
  };
}

afterEach(() => {
  Object.defineProperty(Platform, "OS", { value: originalOS, configurable: true });
});

describe("UserLayout", () => {
  it("renders without crashing on native", () => {
    expect(() => renderOn("ios")).not.toThrow();
  });

  it("keeps the full-bleed home screen out of the native header", () => {
    const { optionsFor } = renderOn("ios");

    expect(optionsFor("index")).toMatchObject({ headerShown: false });
  });

  it("keeps the legacy /search redirect out of the native header", () => {
    const { optionsFor } = renderOn("ios");

    expect(optionsFor("search")).toMatchObject({ headerShown: false });
  });

  it("draws no rule under the header", () => {
    const { screenOptions } = renderOn("ios");

    expect(screenOptions).toMatchObject({ headerShadowVisible: false });
  });
});

describe("UserLayout tab roots", () => {
  // The pair is the rule: the tab bar is the way between the roots, so a root draws no header
  // and no back arrow, while a screen pushed over one keeps the header whose arrow drives the
  // swipe-back gesture.
  it.each(["index", "locations/index", "lookup"])(
    "draws the %s tab root with no header and no swipe back",
    (name) => {
      const { optionsFor } = renderOn("ios");

      expect(optionsFor(name)).toMatchObject({ headerShown: false, gestureEnabled: false });
    }
  );

  // The confirmation is LookupScreen with a ref prefilled, not a detail over the booking
  // form: it draws the way /lookup does, and there is nothing behind it worth swiping to —
  // the form would re-offer a table the diner has already booked.
  it("draws the booking confirmation the way its own lookup root draws", () => {
    const { optionsFor } = renderOn("ios");

    expect(optionsFor("booking-confirmation/[bookingRef]")).toMatchObject({
      headerShown: false,
      gestureEnabled: false,
    });
  });

  it("keeps the header on the pushed locations/[id] detail screen", () => {
    const { optionsFor } = renderOn("ios");

    expect(optionsFor("locations/[id]")).not.toHaveProperty("headerShown");
    expect(optionsFor("locations/[id]")).not.toHaveProperty("gestureEnabled");
  });

  it("holds on Android too, where the system back covers the roots", () => {
    const { optionsFor } = renderOn("android");

    expect(optionsFor("lookup")).toMatchObject({ headerShown: false });
    expect(optionsFor("locations/index")).toMatchObject({ headerShown: false });
  });
});

describe("UserLayout back button", () => {
  it("shrinks the iOS back button to its chevron so a long title cannot crowd it", () => {
    const { screenOptions } = renderOn("ios");

    expect(screenOptions).toMatchObject({ headerBackButtonDisplayMode: "minimal" });
  });

  it("leaves the iOS-only display mode off Android", () => {
    const { screenOptions } = renderOn("android");

    expect(screenOptions).not.toHaveProperty("headerBackButtonDisplayMode");
  });
});

/**
 * Issue #428. The large title is the cheapest cue that a pushed screen is native, and it is
 * iOS-only — Material has no collapsing title, so asking Android for one is a no-op that
 * would still read as an intent the platform ignores.
 */
describe("UserLayout large titles", () => {
  it("gives pushed iOS screens a collapsing large title with no rule under it", () => {
    const { screenOptions } = renderOn("ios");

    expect(screenOptions).toMatchObject({
      headerLargeTitle: true,
      headerLargeTitleShadowVisible: false,
    });
  });

  it("leaves the iOS-only large title off Android", () => {
    const { screenOptions } = renderOn("android");

    expect(screenOptions).not.toHaveProperty("headerLargeTitle");
  });

  // The tab roots draw their own ScreenHeading under no header at all, so the large title
  // must not reach them — headerShown: false is what keeps the two models from stacking.
  it("does not reach the header-less tab roots", () => {
    const { optionsFor } = renderOn("ios");

    expect(optionsFor("index")).toMatchObject({ headerShown: false });
    expect(optionsFor("lookup")).toMatchObject({ headerShown: false });
    expect(optionsFor("locations/index")).toMatchObject({ headerShown: false });
  });
});
