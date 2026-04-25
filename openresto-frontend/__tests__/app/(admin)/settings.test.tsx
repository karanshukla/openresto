/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react-native";
import AdminSettingsScreen from "@/app/(admin)/settings";
import { fetchRestaurants } from "@/api/restaurants";
import { AppThemeProvider } from "@/context/ThemeContext";
import { BrandProvider } from "@/context/BrandContext";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Polyfill fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
  })
) as jest.Mock;

jest.mock("@/api/restaurants");
jest.mock("@/api/admin");
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
}));
jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));
jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

// Mock sub-components to focus on AdminSettingsScreen container
jest.mock("@/components/admin/settings/LocationCard", () => ({
  LocationCard: ({ onSelect, confirmAction }: any) => {
    const { View, Pressable, Text } = require("react-native");
    return (
      <View>
        <Pressable testID="select-location" onPress={onSelect}>
          <Text>Select</Text>
        </Pressable>
        <Pressable testID="trigger-confirm" onPress={() => confirmAction("Test Message")}>
          <Text>Confirm</Text>
        </Pressable>
      </View>
    );
  }
}));
jest.mock("@/components/admin/settings/BrandSettingsCard", () => ({ BrandSettingsCard: () => null }));
jest.mock("@/components/admin/settings/EmailSettingsCard", () => ({ EmailSettingsCard: () => null }));
jest.mock("@/components/admin/settings/SecurityCard", () => ({ SecurityCard: () => null }));

jest.setTimeout(15000);

describe("AdminSettingsScreen", () => {
  const mockRestaurants = [{ id: 1, name: "Resto 1", sections: [] }];

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

  it("renders locations after loading", async () => {
    renderWithProviders(<AdminSettingsScreen />);
    // Just wait for loading to finish
    await waitFor(() => expect(screen.queryByText("1 location configured")).toBeTruthy());
  });

  it("handles empty locations list", async () => {
    (fetchRestaurants as jest.Mock).mockResolvedValue([]);
    renderWithProviders(<AdminSettingsScreen />);
    await waitFor(() => expect(screen.getByText("No locations found")).toBeTruthy());
  });

  it("handles confirm flow through useConfirmLocal", async () => {
    renderWithProviders(<AdminSettingsScreen />);
    await waitFor(() => screen.getByTestId("trigger-confirm"));

    // 1. Trigger confirm
    let confirmResult: boolean | undefined;
    fireEvent.press(screen.getByTestId("trigger-confirm"));
    
    expect(screen.getByText("Test Message")).toBeTruthy();

    // 2. Cancel
    fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() => expect(screen.queryByText("Test Message")).toBeNull());

    // 3. Confirm again and success
    fireEvent.press(screen.getByTestId("trigger-confirm"));
    fireEvent.press(screen.getByText("Delete"));
    await waitFor(() => expect(screen.queryByText("Test Message")).toBeNull());
  });
});
