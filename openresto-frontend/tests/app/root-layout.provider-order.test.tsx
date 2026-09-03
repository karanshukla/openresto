/**
 * @jest-environment jsdom
 */
import React from "react";
import { View } from "react-native";
import { render, screen, within } from "@testing-library/react-native";

// Prefixed `mock` so babel-plugin-jest-hoist allows the factories below to reach it, and a
// function declaration so it is defined by the time a lazily-evaluated factory runs.
function mockMarker(testID: string) {
  return ({ children }: { children?: React.ReactNode }) =>
    React.createElement(View, { testID }, children);
}

jest.mock("expo-router", () => {
  const { View: RNView } = require("react-native");
  const React2 = require("react");
  const Stack = ({ children }: any) => React2.createElement(RNView, { testID: "stack" }, children);
  Stack.Screen = () => null;
  return {
    Stack,
    ThemeProvider: ({ children }: any) => children,
    DarkTheme: { dark: true, colors: {}, fonts: {} },
    DefaultTheme: { dark: false, colors: {}, fonts: {} },
    usePathname: () => "/",
    useSegments: () => [],
  };
});

jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("react-native-reanimated", () => ({}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaProvider: ({ children }: any) => children,
}));

jest.mock("@/context/BrandContext", () => ({
  BrandProvider: mockMarker("brand-provider"),
  useBrand: () => ({ appName: "Test App", primaryColor: "#ff0000" }),
}));
jest.mock("@/context/LocaleContext", () => ({ LocaleProvider: mockMarker("locale-provider") }));
jest.mock("@/context/ThemeContext", () => ({ AppThemeProvider: mockMarker("theme-provider") }));
jest.mock("@/components/booking/BookingSheetHost", () => ({
  BookingSheetHost: mockMarker("sheet-host"),
}));
jest.mock("@/hooks/use-color-scheme", () => ({ useColorScheme: () => "light" }));

const RootLayout = require("@/app/_layout").default;

/**
 * The native sheet renders its content through `@gorhom/portal`, which re-renders the node at
 * the portal host's own position in the tree rather than where the sheet was opened. Anything
 * mounted above the host is therefore invisible to the sheet's content: with the host outermost,
 * as it originally was, every sheet read `DEFAULT_BRAND`'s stock teal and `ThemeContext`'s dark
 * default and so ignored both the restaurant's brand colour and the visitor's light/dark pick.
 */
describe("RootLayout provider order", () => {
  it("mounts the booking sheet host inside the brand, locale and theme providers", () => {
    render(<RootLayout />);

    const brand = screen.getByTestId("brand-provider");
    const locale = within(brand).getByTestId("locale-provider");
    const theme = within(locale).getByTestId("theme-provider");
    expect(within(theme).getByTestId("sheet-host")).toBeTruthy();
  });

  it("keeps the navigator inside the sheet host, so a sheet can cover any screen", () => {
    render(<RootLayout />);

    expect(within(screen.getByTestId("sheet-host")).getByTestId("stack")).toBeTruthy();
  });
});
