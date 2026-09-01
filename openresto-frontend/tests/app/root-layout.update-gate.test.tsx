/**
 * @jest-environment jsdom
 *
 * The minimum-supported-version gate, which only exists off web. `root-layout.test.tsx` runs
 * the same layout as the web build (where the gate never applies) and Platform.OS is per-file,
 * so the two platforms are two files.
 */
import React from "react";

jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  rn.Platform.OS = "ios";
  return rn;
});

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { name: "t", slug: "t", version: "1.8.9" } },
}));

import { render, screen } from "@testing-library/react-native";

jest.mock("expo-router", () => {
  const { View } = require("react-native");
  const React = require("react");
  const Stack = ({ children }: any) => React.createElement(View, { testID: "stack" }, children);
  Stack.Screen = () => null;
  return {
    Stack,
    usePathname: () => "/",
    useSegments: () => [],
  };
});

jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));

let mockBrand: { appName: string; primaryColor: string; minimumAppVersion?: string } = {
  appName: "Test Resto",
  primaryColor: "#0a7ea4",
};

jest.mock("@/context/BrandContext", () => ({
  BrandProvider: ({ children }: any) => children,
  useBrand: () => mockBrand,
}));

jest.mock("@/context/LocaleContext", () => ({
  LocaleProvider: ({ children }: any) => children,
}));

jest.mock("@/context/ThemeContext", () => ({
  AppThemeProvider: ({ children }: any) => children,
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: any) => children,
}));

jest.mock("react-native-reanimated", () => ({}));

const RootLayout = require("@/app/_layout").default;

describe("RootLayout version gate (native)", () => {
  it("renders the navigator when the build meets the server's minimum", () => {
    mockBrand = { appName: "Test Resto", primaryColor: "#0a7ea4", minimumAppVersion: "1.8.9" };

    render(<RootLayout />);

    expect(screen.getByTestId("stack")).toBeTruthy();
    expect(screen.queryByTestId("update-required")).toBeNull();
  });

  it("replaces the navigator with the update screen one patch below the minimum", () => {
    mockBrand = { appName: "Test Resto", primaryColor: "#0a7ea4", minimumAppVersion: "1.9.0" };

    render(<RootLayout />);

    expect(screen.getByTestId("update-required")).toBeTruthy();
    expect(screen.queryByTestId("stack")).toBeNull();
  });

  it("renders the navigator when the server names no minimum at all", () => {
    mockBrand = { appName: "Test Resto", primaryColor: "#0a7ea4" };

    render(<RootLayout />);

    expect(screen.getByTestId("stack")).toBeTruthy();
  });
});
