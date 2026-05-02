/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
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

import { useWindowDimensions } from "react-native";

jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  return {
    ...rn,
    useWindowDimensions: jest.fn().mockReturnValue({ width: 1024, height: 768 }),
  };
});

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

  it("renders logo when logoUrl is provided", () => {
    (useAppTheme as jest.Mock).mockReturnValue({
      brand: { appName: "Logo App", primaryColor: "#0a7ea4", logoUrl: "http://logo.com" },
      colors: { border: "#ccc", muted: "#666" },
      primaryColor: "#0a7ea4",
      isDark: false,
    });
    render(<Navbar />);
    // The Image component will have accessibilityLabel set to brand.appName
    expect(screen.getByLabelText("Logo App")).toBeTruthy();
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

  it("calls toggle when theme button is pressed", () => {
    render(<Navbar />);
    const themeBtn = screen.getByLabelText("Switch to dark mode");
    fireEvent.press(themeBtn);
    expect(mockToggle).toHaveBeenCalled();
  });

  it("filters admin links on mobile", () => {
    (useWindowDimensions as jest.Mock).mockReturnValue({ width: 500, height: 768 });
    render(<Navbar />);
    expect(screen.queryByText("Admin")).toBeNull();
    expect(screen.getByText("Home")).toBeTruthy();
  });

  it("shows active state for current link", () => {
    (usePathname as jest.Mock).mockReturnValue("/lookup");
    render(<Navbar />);
    expect(screen.getByText("My Bookings")).toBeTruthy();
  });
});
