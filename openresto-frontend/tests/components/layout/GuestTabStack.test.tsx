import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Platform, View } from "react-native";
import { usePathname } from "expo-router";
import GuestTabStack, { guestHeader, tabRoot } from "@/components/layout/GuestTabStack";
import { useOnline } from "@/hooks/use-online";

// Populated by the Stack mock below. Named with the `mock` prefix so the jest.mock factory is
// allowed to close over it.
const mockScreenOptions: Record<string, unknown>[] = [];

jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Stack = ({
    screenOptions,
    children,
  }: {
    screenOptions?: { headerRight?: () => React.ReactNode };
    children?: React.ReactNode;
  }) => {
    mockScreenOptions.push(screenOptions ?? {});
    return React.createElement(View, { testID: "stack" }, screenOptions?.headerRight?.(), children);
  };
  Stack.Screen = () => null;
  return {
    Stack,
    Slot: () => React.createElement(View, { testID: "slot" }),
    usePathname: jest.fn(() => "/"),
  };
});

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, { testID: "tab-safe-area" }, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: () => ({
    brand: { appName: "Open Resto", primaryColor: "#0a7ea4" },
    colors: { muted: "#666", card: "#fff", border: "#ccc", page: "#fafafa", surfaceAlt: "#eee" },
    primaryColor: "#0a7ea4",
    isDark: false,
  }),
}));

jest.mock("@/hooks/use-online", () => ({ useOnline: jest.fn(() => true) }));

// The control itself is pinned by GuestSettingsMenu's own tests; here only where it lands is
// the question.
jest.mock("@/components/layout/GuestSettingsMenu", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ testID = "guest-settings-open" }: { testID?: string }) => <View testID={testID} />,
  };
});

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
const originalOS = Platform.OS;

beforeEach(() => {
  mockScreenOptions.length = 0;
  (usePathname as jest.Mock).mockReturnValue("/");
  (useOnline as jest.Mock).mockReturnValue(true);
});

afterEach(() => setPlatform(originalOS));

const renderStack = () =>
  render(
    <GuestTabStack>
      <View testID="tab-routes" />
    </GuestTabStack>
  );

/**
 * Issue #426. One of these sits inside each tab of the native tab bar. Web is not one of its
 * concerns: there the navbar is the way between the guest screens, and the group's routes go
 * straight through.
 */
describe("GuestTabStack", () => {
  it("passes the routes straight through on web, with none of the native chrome", () => {
    setPlatform("web");
    renderStack();

    expect(screen.getByTestId("slot")).toBeTruthy();
    expect(screen.queryByTestId("stack")).toBeNull();
    expect(screen.queryByTestId("tab-safe-area")).toBeNull();
    expect(screen.queryByTestId("guest-settings-anchor")).toBeNull();
  });

  it("hosts the group's screens in a stack off web", () => {
    setPlatform("ios");
    renderStack();

    expect(screen.getByTestId("stack")).toBeTruthy();
    expect(screen.getByTestId("tab-routes")).toBeTruthy();
    expect(screen.queryByTestId("slot")).toBeNull();
  });

  // Inside a tab `useSafeAreaInsets` has to answer for the tab's own content area — the bar's
  // height at the bottom on iOS, nothing on Android — which only a provider inside the tab can
  // do. The window's provider would report the home indicator and leave a root's last rows
  // under the iOS bar.
  it("wraps the stack in the tab's own safe-area provider", () => {
    setPlatform("ios");
    renderStack();

    const provider = screen.getByTestId("tab-safe-area");
    expect(provider.findByProps({ testID: "stack" })).toBeTruthy();
  });

  it("puts the settings control in the header of every pushed screen", () => {
    setPlatform("ios");
    renderStack();

    expect(screen.getByTestId("guest-settings-open")).toBeTruthy();
  });

  // A tab root has no header to carry the control, so the same control is pinned over the
  // stack instead of scrolling away inside the page; a pushed screen has the header already.
  it("pins the same control over the stack on a header-less root, and not over a pushed screen", () => {
    setPlatform("ios");
    renderStack();
    expect(screen.getByTestId("guest-settings-anchor-open")).toBeTruthy();

    screen.unmount();
    (usePathname as jest.Mock).mockReturnValue("/locations/3");
    renderStack();
    expect(screen.queryByTestId("guest-settings-anchor-open")).toBeNull();
  });

  it("shows no offline strip while the device is connected", () => {
    setPlatform("ios");
    renderStack();

    expect(screen.queryByTestId("offline-banner")).toBeNull();
  });

  it("shows the offline strip above the stack when it is not", () => {
    setPlatform("ios");
    (useOnline as jest.Mock).mockReturnValue(false);
    renderStack();

    expect(screen.getByTestId("offline-banner")).toBeTruthy();
  });

  it("draws no rule under the header", () => {
    setPlatform("android");
    renderStack();

    expect(mockScreenOptions[0]).toMatchObject({ headerShadowVisible: false });
  });
});

/**
 * Issue #428. The large title is the cheapest cue that a pushed screen is native, and it is
 * iOS-only — Material has no collapsing title, so asking Android for one is a no-op that would
 * still read as an intent the platform ignores. Same for the chevron-only back button.
 */
describe("guestHeader", () => {
  it("gives pushed iOS screens a minimal back button and a collapsing large title", () => {
    setPlatform("ios");

    expect(guestHeader()).toEqual({
      headerShadowVisible: false,
      headerBackButtonDisplayMode: "minimal",
      headerLargeTitle: true,
      headerLargeTitleShadowVisible: false,
    });
  });

  it("leaves the iOS-only options off Android", () => {
    setPlatform("android");

    expect(guestHeader()).toEqual({ headerShadowVisible: false });
  });
});

// The tab bar is the way between the roots, so a root draws no header and no back arrow; the
// screens pushed over one keep both, which `guestHeader` alone leaves in place.
describe("tabRoot", () => {
  it("takes the header and the swipe back off a root", () => {
    expect(tabRoot()).toEqual({ headerShown: false, gestureEnabled: false });
  });

  it("is not what a pushed screen gets", () => {
    setPlatform("ios");

    expect(guestHeader()).not.toHaveProperty("headerShown");
    expect(guestHeader()).not.toHaveProperty("gestureEnabled");
  });
});
