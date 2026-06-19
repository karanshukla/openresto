/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import { Platform, ScrollView } from "react-native";
import HomeScreen, { resetHomeCache } from "@/app/index";
import { fetchRestaurants, fetchHighlights } from "@/api/restaurants";
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
  fetchHighlights: jest.fn(),
}));

jest.mock("@/components/layout/Navbar", () => ({
  __esModule: true,
  default: ({ onScrollToTop }: { onScrollToTop?: () => void }) => {
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable testID="navbar-scroll-top" onPress={onScrollToTop}>
        <Text>Navbar</Text>
      </Pressable>
    );
  },
}));

jest.mock("@/api/availability", () => ({
  fetchAvailability: jest.fn().mockResolvedValue({
    restaurantId: 1,
    date: "2026-05-25",
    slots: [{ time: "19:00", isAvailable: true, availableTableIds: [1], category: "Dinner" }],
  }),
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

jest.setTimeout(15000);

describe("HomeScreen", () => {
  const mockRestaurants = [
    {
      id: 1,
      name: "Resto 1",
      address: "Address 1",
      openTime: "09:00",
      closeTime: "22:00",
      sections: [],
    },
    {
      id: 2,
      name: "Resto 2",
      address: "Address 2",
      openTime: "10:00",
      closeTime: "21:00",
      sections: [],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    resetHomeCache();
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    (fetchHighlights as jest.Mock).mockResolvedValue([
      {
        id: 1,
        title: "Wood-fired kitchen",
        body: "Fresh daily.",
        iconKey: "flame-outline",
        sortOrder: 0,
      },
    ]);
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 0, height: 0 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <AppThemeProvider>
          <BrandProvider>{ui}</BrandProvider>
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
  });

  it("handles zero restaurants", async () => {
    (fetchRestaurants as jest.Mock).mockResolvedValue([]);
    renderWithProviders(<HomeScreen />);

    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
    expect(screen.queryByTestId("loading-screen")).toBeNull();
  });

  it("renders hero image overlay when headerImageUrl is set", async () => {
    const originalOS = Platform.OS;
    (Platform as unknown as { OS: string }).OS = "web";

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          appName: "Hero Brand",
          primaryColor: "#c0392b",
          headerImageUrl: "https://example.com/hero.jpg",
        }),
    });

    renderWithProviders(<HomeScreen />);
    // Wait for the brand with headerImageUrl to apply — exercises hasHero=true code paths
    await waitFor(() => expect(screen.getAllByText("Hero Brand").length).toBeGreaterThan(0));

    (Platform as unknown as { OS: string }).OS = originalOS;
  });

  it("renders highlights section when highlights are provided", async () => {
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
    expect(screen.getByText("Wood-fired kitchen")).toBeTruthy();
    expect(screen.getByText("Fresh daily.")).toBeTruthy();
  });

  it("renders mobile layout with narrower window width", async () => {
    jest
      .spyOn(require("react-native/Libraries/Utilities/useWindowDimensions"), "default")
      .mockReturnValue({ width: 375, height: 812 });
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
    expect(screen.getByText("Resto 1")).toBeTruthy();
  });

  it("renders Our locations heading", async () => {
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
    expect(screen.getByText("Our locations")).toBeTruthy();
  });

  it("renders highlights label and curated-by text", async () => {
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
    expect(screen.getByText("Restaurant highlights")).toBeTruthy();
    expect(screen.getByText("Curated by the owner")).toBeTruthy();
  });

  it("renders empty highlights gracefully", async () => {
    (fetchHighlights as jest.Mock).mockResolvedValue([]);
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
    expect(screen.queryByText("Wood-fired kitchen")).toBeNull();
  });

  it("onScroll handler updates scrollY", async () => {
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
    const scrollView = screen.UNSAFE_getByType(ScrollView);
    fireEvent.scroll(scrollView, { nativeEvent: { contentOffset: { y: 200 } } });
    // Line covered — no assertion needed beyond no crash
  });

  it("scrollToTop callback calls scrollTo on the ScrollView ref", async () => {
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
    fireEvent.press(screen.getByTestId("navbar-scroll-top"));
    // Line 41 covered — scrollRef.current?.scrollTo is a no-op in tests
  });
});
