import React from "react";
import { render, screen } from "@testing-library/react-native";
import Navbar from "@/components/layout/Navbar";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ colorScheme: "light", toggle: jest.fn() }),
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Test App", primaryColor: "#0a7ea4" }),
}));

jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePathname: () => "/",
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("react-native-safe-area-context", () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: jest.fn(({ children }) => children),
    SafeAreaConsumer: jest.fn(({ children }) => children(inset)),
    useSafeAreaInsets: jest.fn(() => inset),
    useSafeAreaFrame: jest.fn(() => ({ x: 0, y: 0, width: 0, height: 0 })),
  };
});

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1024, height: 768 }),
}));

describe("Navbar", () => {
  it("renders the brand name", () => {
    render(<Navbar />);
    expect(screen.getByText("Test App")).toBeTruthy();
  });

  it("renders Home link", () => {
    render(<Navbar />);
    expect(screen.getByText("Home")).toBeTruthy();
  });

  it("renders My Bookings link", () => {
    render(<Navbar />);
    expect(screen.getByText("My Bookings")).toBeTruthy();
  });

  it("renders Admin link on wide screens", () => {
    render(<Navbar />);
    expect(screen.getByText("Admin")).toBeTruthy();
  });
});
