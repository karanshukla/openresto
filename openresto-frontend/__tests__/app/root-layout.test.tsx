/**
 * @jest-environment jsdom
 */
import React from "react";

// Mock react-native early
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  rn.Platform.OS = "web";
  rn.Platform.select = (obj: any) => obj.web;
  return rn;
});

// Mock web APIs early
Object.defineProperty(window, "localStorage", {
  value: {
    getItem: jest.fn().mockReturnValue("dark"),
    setItem: jest.fn(),
  },
  writable: true,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

Object.defineProperty(window, "navigator", {
  value: {
    serviceWorker: {
      register: jest.fn().mockResolvedValue({}),
    },
  },
  writable: true,
});

// Import RootLayout AFTER web API mocks
const RootLayout = require("@/app/_layout").default;

import { render, screen, waitFor } from "@testing-library/react-native";

jest.mock("expo-router", () => {
  const { View } = require("react-native");
  const React = require("react");
  const Stack = ({ children }: any) => React.createElement(View, { testID: "stack" }, children);
  Stack.Screen = () => null;
  return {
    Stack,
    usePathname: jest.fn().mockReturnValue("/"),
    useSegments: jest.fn().mockReturnValue([]),
  };
});

jest.mock("expo-status-bar", () => ({
  StatusBar: () => null,
}));

jest.mock("@/context/BrandContext", () => ({
  BrandProvider: ({ children }: any) => children,
  useBrand: () => ({ appName: "Test App", primaryColor: "#000" }),
}));

jest.mock("@/context/ThemeContext", () => ({
  AppThemeProvider: ({ children }: any) => children,
  useTheme: () => ({ colorScheme: "light" }),
}));

jest.mock("@react-navigation/native", () => ({
  DarkTheme: {},
  DefaultTheme: {},
  ThemeProvider: ({ children }: any) => children,
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("react-native-reanimated", () => ({}));

import { usePathname, useSegments } from "expo-router";

describe("RootLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usePathname as jest.Mock).mockReturnValue("/");
    (useSegments as jest.Mock).mockReturnValue([]);
  });

  it("renders correctly on web and sets title", async () => {
    (useSegments as jest.Mock).mockReturnValue(["book"]);
    render(<RootLayout />);
    await waitFor(() => expect(screen.getByTestId("stack")).toBeTruthy());
    expect(document.title).toContain("Reserve a Table");
  });

  it("sets different titles for different segments", async () => {
    const segments = ["lookup", "booking-confirmation", "restaurant", "unknown", "(user)"];
    const titles = [
      "Find My Booking",
      "Booking Confirmed",
      "Restaurant Details",
      "Unknown",
      "Test App",
    ];

    for (let i = 0; i < segments.length; i++) {
      (useSegments as jest.Mock).mockReturnValue([segments[i]]);
      render(<RootLayout />);
      if (segments[i] === "(user)") {
        await waitFor(() => expect(document.title).toBe(titles[i]));
      } else {
        await waitFor(() => expect(document.title).toContain(titles[i]));
      }
    }
  });

  it("renders correctly on native", async () => {
    const { Platform } = require("react-native");
    Platform.OS = "ios";
    render(<RootLayout />);
    await waitFor(() => expect(screen.getByTestId("stack")).toBeTruthy());
  });
});
