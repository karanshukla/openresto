import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import GuestTabBar from "@/components/layout/GuestTabBar";
import { usePathname, useRouter } from "expo-router";
import { StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";

jest.mock("expo-haptics", () => ({ selectionAsync: jest.fn() }));

const mockNavigate = jest.fn();

jest.mock("expo-router", () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: () => ({
    brand: { appName: "Test App", primaryColor: "#0a7ea4" },
    colors: { muted: "#666", border: "#ccc", page: "#fff", card: "#fafafa", text: "#111" },
    primaryColor: "#0a7ea4",
    isDark: false,
  }),
}));

const at = (pathname: string) => {
  (usePathname as jest.Mock).mockReturnValue(pathname);
  render(<GuestTabBar />);
};

const selected = (label: string) => screen.getByLabelText(label).props.accessibilityState?.selected;

beforeEach(() => {
  jest.clearAllMocks();
  (useRouter as jest.Mock).mockReturnValue({ navigate: mockNavigate });
});

describe("GuestTabBar", () => {
  it("offers the two screens the web navbar owns, plus home", () => {
    at("/");
    expect(screen.getByLabelText("Home")).toBeTruthy();
    expect(screen.getByLabelText("Locations")).toBeTruthy();
    expect(screen.getByLabelText("My Bookings")).toBeTruthy();
  });

  it("navigates to the tab's route on press", () => {
    at("/");
    fireEvent.press(screen.getByLabelText("Locations"));
    expect(mockNavigate).toHaveBeenCalledWith("/locations");
  });

  it("answers the press with a tick before moving", () => {
    at("/");
    fireEvent.press(screen.getByLabelText("Locations"));
    expect(Haptics.selectionAsync).toHaveBeenCalled();
  });

  const setPlatform = (os: string) =>
    Object.defineProperty(require("react-native").Platform, "OS", {
      value: os,
      configurable: true,
    });

  /**
   * #426: an iOS tab bar is translucent and the list scrolls under it; Android's Material 3
   * bar is an opaque surface. Painting one like the other is a large part of what made this
   * read as a hand-drawn bar rather than the platform's own.
   */
  describe("bar surface", () => {
    const originalOS = require("react-native").Platform.OS;
    afterEach(() => setPlatform(originalOS));

    it("lets the list show through a blur on iOS", () => {
      setPlatform("ios");
      at("/");

      const bar = StyleSheet.flatten(screen.getByTestId("guest-tab-bar").props.style);
      expect(bar.backgroundColor).toBe("transparent");
      expect(screen.getByTestId("guest-tab-bar-blur")).toBeTruthy();
      expect(bar.borderTopColor).toBe("#ccc");
    });

    it("sits on an opaque card surface on Android, with no blur", () => {
      setPlatform("android");
      at("/");

      const bar = StyleSheet.flatten(screen.getByTestId("guest-tab-bar").props.style);
      expect(bar.backgroundColor).toBe("#fafafa");
      expect(screen.queryByTestId("guest-tab-bar-blur")).toBeNull();
    });

    // Material 3 marks the selected destination with a pill; iOS marks it with tint alone,
    // so a pill drawn there would be a second selection cue the platform does not use.
    it("draws the selected pill on Android and not on iOS", () => {
      setPlatform("android");
      at("/");
      expect(
        StyleSheet.flatten(screen.getByTestId("guest-tab-indicator").props.style).backgroundColor
      ).toBeDefined();

      setPlatform("ios");
      at("/");
      expect(
        StyleSheet.flatten(screen.getByTestId("guest-tab-indicator").props.style).backgroundColor
      ).toBeUndefined();
    });
  });

  /**
   * Home matches exactly and the others by prefix. Matching "/" by prefix would light up
   * Home on every screen in the app, which is the bug the pair below exists to catch.
   */
  it("marks Home active only on the home path itself", () => {
    at("/");
    expect(selected("Home")).toBe(true);
  });

  it("does not mark Home active on another route", () => {
    at("/locations");
    expect(selected("Home")).toBe(false);
    expect(selected("Locations")).toBe(true);
  });

  it("keeps Locations selected on a nested location route", () => {
    at("/locations/3");
    expect(selected("Locations")).toBe(true);
  });

  it("keeps My Bookings selected on the lookup route", () => {
    at("/lookup");
    expect(selected("My Bookings")).toBe(true);
    expect(selected("Locations")).toBe(false);
  });

  it("keeps My Bookings selected on a booking confirmation, which is a lookup result", () => {
    at("/booking-confirmation/ABC123");
    expect(selected("My Bookings")).toBe(true);
    expect(selected("Home")).toBe(false);
  });
});
