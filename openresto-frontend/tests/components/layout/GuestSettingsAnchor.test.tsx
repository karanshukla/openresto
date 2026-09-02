import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Platform, StyleSheet } from "react-native";
import { usePathname } from "expo-router";
import GuestSettingsAnchor from "@/components/layout/GuestSettingsAnchor";
import { SETTINGS_ANCHOR_EDGE } from "@/components/layout/GuestSettingsAnchor.styles";

jest.mock("expo-router", () => ({ usePathname: jest.fn() }));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 0, left: 0, right: 8 }),
}));

jest.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: () => ({
    brand: { appName: "Test App", primaryColor: "#0a7ea4" },
    colors: { muted: "#666", border: "#ccc", card: "#fafafa", page: "#fff", text: "#111" },
    primaryColor: "#0a7ea4",
    isDark: false,
  }),
}));

// The control itself is pinned by GuestSettingsMenu's own tests; here only where it lands and
// whether it lands at all is the question.
jest.mock("@/components/layout/GuestSettingsMenu", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ testID }: { testID: string }) => <View testID={testID} />,
  };
});

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, "OS", { get: () => os, configurable: true });

const original = Platform.OS;
afterEach(() => setPlatform(original));

const at = (pathname: string) => {
  (usePathname as jest.Mock).mockReturnValue(pathname);
  render(<GuestSettingsAnchor />);
};

/**
 * The control is pinned over the stack rather than drawn inside a screen, so the question it
 * has to answer is "is this route one that has no header of its own" — exactly, since a screen
 * pushed over a root has a header carrying the control already and would otherwise show two.
 */
describe("GuestSettingsAnchor", () => {
  it.each(["/", "/locations", "/lookup"])("carries the control on the %s root", (path) => {
    setPlatform("ios");
    at(path);
    expect(screen.getByTestId("guest-settings-anchor-open")).toBeTruthy();
  });

  it.each(["/locations/3", "/restaurant/3", "/book/3", "/booking-confirmation/ABC123"])(
    "leaves %s to the header it is pushed under",
    (path) => {
      setPlatform("ios");
      at(path);
      expect(screen.queryByTestId("guest-settings-anchor-open")).toBeNull();
    }
  );

  it("never renders on web, whose navbar owns the same menu", () => {
    setPlatform("web");
    at("/");
    expect(screen.queryByTestId("guest-settings-anchor-open")).toBeNull();
  });

  it("clears the status bar and any display cutout on the trailing edge", () => {
    setPlatform("ios");
    at("/");
    const anchor = StyleSheet.flatten(screen.getByTestId("guest-settings-anchor").props.style);
    expect(anchor.position).toBe("absolute");
    expect(anchor.top).toBe(47);
    expect(anchor.right).toBe(8 + SETTINGS_ANCHOR_EDGE);
  });

  it("lets presses through everywhere but the control, so the page below stays scrollable", () => {
    setPlatform("ios");
    at("/");
    expect(screen.getByTestId("guest-settings-anchor").props.pointerEvents).toBe("box-none");
  });
});
