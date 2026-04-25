/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import HomeScreen from "@/app/index";
import { fetchRestaurants } from "@/api/restaurants";
import { BrandProvider } from "@/context/BrandContext";

// Polyfill fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
  })
) as jest.Mock;

jest.mock("@expo/vector-icons", () => ({
  Ionicons: jest.fn(() => null),
}));

jest.mock("@/api/restaurants", () => ({
  fetchRestaurants: jest.fn(),
}));

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    Stack: {
      Screen: jest.fn(() => null),
    },
    useRouter: jest.fn(() => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    })),
    usePathname: jest.fn(() => "/"),
    Link: jest.fn(({ children }) => children),
  };
});

import { AppThemeProvider } from "@/context/ThemeContext";
import { SafeAreaProvider } from "react-native-safe-area-context";

describe("HomeScreen", () => {
  const mockRestaurants = [
    { id: 1, name: "Resto 1", address: "Address 1", openTime: "09:00", closeTime: "22:00", sections: [] },
    { id: 2, name: "Resto 2", address: "Address 2", openTime: "10:00", closeTime: "21:00", sections: [] },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 0, height: 0 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <AppThemeProvider>
          <BrandProvider>
            {ui}
          </BrandProvider>
        </AppThemeProvider>
      </SafeAreaProvider>
    );
  };

  it("renders loading state initially", async () => {
    renderWithProviders(<HomeScreen />);
    expect(screen.getByTestId("loading-screen")).toBeTruthy();
    // Wait for effect to finish to avoid unmounted component error
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
  });

  it("renders restaurants after loading", async () => {
    renderWithProviders(<HomeScreen />);

    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());

    expect(screen.getByText("Resto 1")).toBeTruthy();
    expect(screen.getByText("Resto 2")).toBeTruthy();
    expect(screen.getByText("2 restaurants")).toBeTruthy();
  });

  it("handles zero restaurants", async () => {
    (fetchRestaurants as jest.Mock).mockResolvedValue([]);
    renderWithProviders(<HomeScreen />);

    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
    expect(screen.getByText("0 restaurants")).toBeTruthy();
  });
});
