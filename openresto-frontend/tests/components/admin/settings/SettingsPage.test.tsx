/**
 * @jest-environment jsdom
 */
import React from "react";
import { Text,useWindowDimensions } from "react-native";
import { render, screen } from "@testing-library/react-native";

// Mock useWindowDimensions by targeting the internal module (same approach as admin-layout.test).
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: jest.fn(() => ({ width: 1440, height: 900, scale: 1, fontScale: 1 })),
}));

import { SettingsPage } from "@/components/admin/settings/SettingsPage";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

// SettingsPage only reaches for expo-router's Stack.Screen on native; stubbing it keeps the
// whole router (and its URL polyfills) out of this jsdom suite.
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

const setWidth = (width: number) =>
  (useWindowDimensions as unknown as jest.Mock).mockReturnValue({
    width,
    height: 900,
    scale: 1,
    fontScale: 1,
  });

describe("SettingsPage", () => {
  it("renders its title, subtitle and children", () => {
    setWidth(1440);
    render(
      <SettingsPage title="Brand" subtitle="How the site looks.">
        <Text>A card</Text>
      </SettingsPage>
    );
    expect(screen.getByText("Brand")).toBeTruthy();
    expect(screen.getByText("How the site looks.")).toBeTruthy();
    expect(screen.getByText("A card")).toBeTruthy();
  });

  it("renders the aside beside the form on a wide viewport", () => {
    setWidth(1440);
    render(
      <SettingsPage title="Brand" subtitle="sub" aside={<Text>Preview</Text>}>
        <Text>A card</Text>
      </SettingsPage>
    );
    expect(screen.getByText("Preview")).toBeTruthy();
    expect(screen.getByText("A card")).toBeTruthy();
  });

  it("still renders the aside when the viewport is too narrow to split", () => {
    setWidth(900);
    render(
      <SettingsPage title="Brand" subtitle="sub" aside={<Text>Preview</Text>}>
        <Text>A card</Text>
      </SettingsPage>
    );
    expect(screen.getByText("Preview")).toBeTruthy();
    expect(screen.getByText("A card")).toBeTruthy();
  });

  it("does not split when no aside is given, however wide the viewport", () => {
    setWidth(1920);
    render(
      <SettingsPage title="Brand" subtitle="sub">
        <Text>A card</Text>
      </SettingsPage>
    );
    expect(screen.getByText("A card")).toBeTruthy();
  });
});
