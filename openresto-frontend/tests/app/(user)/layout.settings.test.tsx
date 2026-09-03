/**
 * @jest-environment jsdom
 *
 * The native guest chrome, rendered per tab by GuestTabStack: the header control that opens
 * language + appearance (the web build reaches both through the navbar's overflow menu, which
 * does not render off web), the same control pinned over a header-less root, and the offline
 * strip above the tab's stack. The Home tab stands in for all three.
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Platform } from "react-native";
import { useOnline } from "@/hooks/use-online";

Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  return {
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

jest.mock("expo-router", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Stack = ({ children, screenOptions }: any) =>
    React.createElement(View, { testID: "stack" }, screenOptions?.headerRight?.(), children);
  Stack.Screen = () => null;
  return { Stack, Slot: () => null, usePathname: () => "/" };
});

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
}));

jest.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: () => ({
    brand: { appName: "Open Resto", primaryColor: "#0a7ea4" },
    colors: { muted: "#666", input: "#f5f5f5", card: "#fff", border: "#ccc", surfaceAlt: "#eee" },
    primaryColor: "#0a7ea4",
    isDark: false,
  }),
}));

jest.mock("@/api/restaurants", () => ({ fetchSocialLinks: jest.fn().mockResolvedValue([]) }));
jest.mock("@/hooks/use-online", () => ({ useOnline: jest.fn(() => true) }));

import HomeTabLayout from "@/app/(user)/(home)/_layout";

const mockUseOnline = useOnline as jest.MockedFunction<typeof useOnline>;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseOnline.mockReturnValue(true);
});

describe("a guest tab on a device", () => {
  it("puts a settings control in the header, closed to begin with", () => {
    render(<HomeTabLayout />);

    expect(screen.getByTestId("guest-settings-open")).toBeTruthy();
    expect(screen.queryByTestId("theme-radiogroup")).toBeNull();
  });

  // The header is what carries it on a pushed screen; a tab root has no header, so the same
  // control is pinned over the stack instead of scrolling away inside the page.
  it("pins the same control over the stack on a header-less tab root", () => {
    render(<HomeTabLayout />);

    expect(screen.getByTestId("guest-settings-anchor-open")).toBeTruthy();
  });

  // The control opens a menu, and a row opens the pane — the settings do not all arrive at
  // once, which is what keeps any one of them off a scrollbar.
  it("reaches language and appearance from that control, and closes again", () => {
    render(<HomeTabLayout />);

    fireEvent.press(screen.getByTestId("guest-settings-open"));
    expect(screen.getByTestId("guest-settings-language")).toBeTruthy();

    fireEvent.press(screen.getByTestId("guest-settings-appearance"));
    expect(screen.getByTestId("theme-radiogroup")).toBeTruthy();

    fireEvent.press(screen.getByTestId("guest-settings-close"));

    expect(screen.queryByTestId("theme-radiogroup")).toBeNull();
  });

  it("shows no offline strip while the device is connected", () => {
    render(<HomeTabLayout />);

    expect(screen.queryByTestId("offline-banner")).toBeNull();
  });

  it("shows the offline strip above the stack when it is not", () => {
    mockUseOnline.mockReturnValue(false);

    render(<HomeTabLayout />);

    expect(screen.getByTestId("offline-banner")).toBeTruthy();
  });
});
