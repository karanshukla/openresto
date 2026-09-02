import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import GuestTabBar from "@/components/layout/GuestTabBar";
import { usePathname, useRouter } from "expo-router";

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
    colors: { muted: "#666", border: "#ccc", page: "#fff", text: "#111" },
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
});
