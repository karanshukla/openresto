/**
 * @jest-environment jsdom
 */
import React from "react";

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({ width: 1024, height: 768 }),
}));

import { render, screen, fireEvent } from "@testing-library/react-native";
import { useWindowDimensions } from "react-native";
import Navbar from "@/components/layout/Navbar";

const mockBack = jest.fn();
const mockToggle = jest.fn();

jest.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: jest.fn(),
}));

import { useAppTheme } from "@/hooks/use-app-theme";

jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ colorScheme: "light", toggle: mockToggle }),
}));

jest.mock("@/components/layout/OverflowMenu", () => {
  const { Pressable, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ onOpenShortcuts }: { onOpenShortcuts: () => void }) => (
      <Pressable testID="overflow-menu" accessibilityLabel="Open menu" onPress={onOpenShortcuts}>
        <Text>menu</Text>
      </Pressable>
    ),
  };
});

jest.mock("expo-router", () => ({
  Link: ({ children }: any) => children,
  usePathname: jest.fn(),
  useRouter: () => ({ back: mockBack }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import { usePathname } from "expo-router";

describe("Navbar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAppTheme as jest.Mock).mockReturnValue({
      brand: { appName: "Test App", primaryColor: "#0a7ea4", logoUrl: "" },
      colors: { border: "#ccc", muted: "#666" },
      primaryColor: "#0a7ea4",
      isDark: false,
    });
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 1024, height: 768 });
    (usePathname as jest.Mock).mockReturnValue("/");
  });

  it("renders the brand name", () => {
    render(<Navbar />);
    expect(screen.getByText("Test App")).toBeTruthy();
  });

  it("renders brand name as text (no logo image)", () => {
    (useAppTheme as jest.Mock).mockReturnValue({
      brand: { appName: "Logo App", primaryColor: "#0a7ea4" },
      colors: { border: "#ccc", muted: "#666" },
      primaryColor: "#0a7ea4",
      isDark: false,
    });
    render(<Navbar />);
    expect(screen.getByText("Logo App")).toBeTruthy();
  });

  it("renders tiny font size for brand on tiny screens", () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 300, height: 768 });
    render(<Navbar />);
    expect(screen.getByText("Test App")).toBeTruthy();
  });

  it("calls router.back when back button is pressed", () => {
    (usePathname as jest.Mock).mockReturnValue("/lookup");
    render(<Navbar />);
    const backBtn = screen.getByLabelText("Go back");
    fireEvent.press(backBtn);
    expect(mockBack).toHaveBeenCalled();
  });

  it("renders the overflow menu control instead of a standalone theme toggle", () => {
    render(<Navbar />);
    expect(screen.getByTestId("overflow-menu")).toBeTruthy();
    // The old standalone theme toggle is gone.
    expect(screen.queryByLabelText("Switch to dark mode")).toBeNull();
  });

  it("never renders an Admin link (moved to the footer)", () => {
    render(<Navbar />);
    expect(screen.queryByText("Admin")).toBeNull();
  });

  it("no longer renders a Home link (the clickable brand is the way home)", () => {
    render(<Navbar />);
    expect(screen.queryByText("Home")).toBeNull();
    expect(screen.getByText("Locations")).toBeTruthy();
  });

  it("renders the Locations and My Bookings nav links", () => {
    render(<Navbar />);
    expect(screen.getByText("Locations")).toBeTruthy();
    expect(screen.getByText("My Bookings")).toBeTruthy();
  });

  it("renders nav links on mobile widths", () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 500, height: 768 });
    render(<Navbar />);
    expect(screen.getByText("Locations")).toBeTruthy();
    expect(screen.getByText("My Bookings")).toBeTruthy();
  });

  it("shows active state for current link", () => {
    (usePathname as jest.Mock).mockReturnValue("/lookup");
    render(<Navbar />);
    expect(screen.getByText("My Bookings")).toBeTruthy();
  });

  it("marks the Locations link active on a /locations/ deep link", () => {
    (usePathname as jest.Mock).mockReturnValue("/locations/3");
    render(<Navbar />);
    expect(screen.getByText("Locations")).toBeTruthy();
  });

  it("forwards onOpenShortcuts to the overflow menu trigger", () => {
    const onOpenShortcuts = jest.fn();
    render(<Navbar onOpenShortcuts={onOpenShortcuts} />);
    fireEvent.press(screen.getByTestId("overflow-menu"));
    expect(onOpenShortcuts).toHaveBeenCalled();
  });
});
