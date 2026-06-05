/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react-native";
import AdminSettingsScreen from "@/app/(admin)/settings";
import { fetchRestaurants, createRestaurant } from "@/api/restaurants";
import {
  adminGetRestaurants,
  adminDeleteRestaurant,
  adminSetRestaurantArchived,
} from "@/api/admin";
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
jest.mock("@/api/admin", () => ({
  adminGetRestaurants: jest.fn(),
  adminDeleteRestaurant: jest.fn(),
  adminSetRestaurantArchived: jest.fn(),
}));
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
  LocationCard: ({ confirmAction, onSaved }: any) => {
    const { View, Pressable, Text } = require("react-native");
    return (
      <View>
        <Pressable testID="trigger-confirm" onPress={() => confirmAction("Test Message")}>
          <Text>Confirm</Text>
        </Pressable>
        <Pressable testID="trigger-save" onPress={() => onSaved?.({ name: "Patched Name" })}>
          <Text>Save</Text>
        </Pressable>
      </View>
    );
  },
}));
jest.mock("@/components/admin/settings/BrandSettingsCard", () => ({
  BrandSettingsCard: () => null,
}));
jest.mock("@/components/admin/settings/EmailSettingsCard", () => ({
  EmailSettingsCard: () => null,
}));
jest.mock("@/components/admin/settings/SecurityCard", () => ({ SecurityCard: () => null }));
jest.mock("@/components/admin/settings/HighlightsCard", () => ({ HighlightsCard: () => null }));

jest.setTimeout(15000);

describe("AdminSettingsScreen", () => {
  const mockRestaurants = [{ id: 1, name: "Resto 1", sections: [] }];

  beforeEach(() => {
    jest.clearAllMocks();
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    (adminGetRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
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

  it("renders locations after loading", async () => {
    renderWithProviders(<AdminSettingsScreen />);
    // Just wait for loading to finish
    await waitFor(() => expect(screen.queryByText(/1 location configured/)).toBeTruthy());
  });

  it("handles empty locations list", async () => {
    (fetchRestaurants as jest.Mock).mockResolvedValue([]);
    renderWithProviders(<AdminSettingsScreen />);
    await waitFor(() => expect(screen.getByText("No locations found")).toBeTruthy());
  });

  it("patches restaurant when LocationCard onSaved is triggered", async () => {
    renderWithProviders(<AdminSettingsScreen />);
    await waitFor(() => screen.getByTestId("trigger-save"));
    fireEvent.press(screen.getByTestId("trigger-save"));
    await waitFor(() => expect(screen.queryByText("Patched Name")).toBeTruthy());
  });

  it("shows add location form when Add location is pressed", async () => {
    renderWithProviders(<AdminSettingsScreen />);
    await waitFor(() => screen.getByText("Add location"));
    fireEvent.press(screen.getByText("Add location"));
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Location name (e.g. Downtown, Westside)")).toBeTruthy()
    );
  });

  it("adds a new location when Add is pressed with a name", async () => {
    (createRestaurant as jest.Mock).mockResolvedValue({
      id: 2,
      name: "New Location",
      sections: [],
    });
    renderWithProviders(<AdminSettingsScreen />);
    await waitFor(() => screen.getByText("Add location"));
    fireEvent.press(screen.getByText("Add location"));
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Location name (e.g. Downtown, Westside)")).toBeTruthy()
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Location name (e.g. Downtown, Westside)"),
      "New Location"
    );
    await act(async () => {
      fireEvent.press(screen.getByText("Add"));
    });
    expect(createRestaurant).toHaveBeenCalledWith("New Location");
  });

  it("closes add location form when createRestaurant fails", async () => {
    (createRestaurant as jest.Mock).mockResolvedValue(null);
    renderWithProviders(<AdminSettingsScreen />);
    await waitFor(() => screen.getByText("Add location"));
    fireEvent.press(screen.getByText("Add location"));
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Location name (e.g. Downtown, Westside)")).toBeTruthy()
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("Location name (e.g. Downtown, Westside)"),
      "Bad Location"
    );
    await act(async () => {
      fireEvent.press(screen.getByText("Add"));
    });
    await waitFor(() =>
      expect(screen.queryByPlaceholderText("Location name (e.g. Downtown, Westside)")).toBeNull()
    );
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

  it("toggles location section collapsed and expanded", async () => {
    renderWithProviders(<AdminSettingsScreen />);
    await waitFor(() => expect(screen.getByText("Location Manager")).toBeTruthy());
    fireEvent.press(screen.getByText("Location Manager"));
    await waitFor(() => expect(screen.queryByText("Add location")).toBeNull());
    fireEvent.press(screen.getByText("Location Manager"));
    await waitFor(() => expect(screen.getByText("Add location")).toBeTruthy());
  });

  it("shows 0 locations configured when empty", async () => {
    (fetchRestaurants as jest.Mock).mockResolvedValue([]);
    (adminGetRestaurants as jest.Mock).mockResolvedValue([]);
    renderWithProviders(<AdminSettingsScreen />);
    await waitFor(() => expect(screen.getByText("0 locations configured")).toBeTruthy());
  });

  it("expands danger zone and shows select-a-location placeholder", async () => {
    renderWithProviders(<AdminSettingsScreen />);
    await waitFor(() => expect(screen.getByText("Archive / Delete Location")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive / Delete Location"));
    await waitFor(() =>
      expect(screen.getByText("Select a location above to see options.")).toBeTruthy()
    );
  });

  it("collapses danger zone and resets step", async () => {
    renderWithProviders(<AdminSettingsScreen />);
    await waitFor(() => expect(screen.getByText("Archive / Delete Location")).toBeTruthy());
    // Expand
    fireEvent.press(screen.getByText("Archive / Delete Location"));
    await waitFor(() =>
      expect(screen.getByText("Select a location above to see options.")).toBeTruthy()
    );
    // Collapse
    fireEvent.press(screen.getByText("Archive / Delete Location"));
    await waitFor(() =>
      expect(screen.queryByText("Select a location above to see options.")).toBeNull()
    );
  });

  it("selects a location in the danger zone", async () => {
    (adminGetRestaurants as jest.Mock).mockResolvedValue([{ id: 1, name: "Resto 1" }]);
    renderWithProviders(<AdminSettingsScreen />);
    await waitFor(() => expect(screen.getByText("Archive / Delete Location")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive / Delete Location"));
    await waitFor(() =>
      expect(screen.getByText("Select a location above to see options.")).toBeTruthy()
    );
    // Press the restaurant pill in danger zone
    const restoPills = screen.getAllByText("Resto 1");
    fireEvent.press(restoPills[restoPills.length - 1]);
    await waitFor(() => expect(screen.getByText("Archive Location")).toBeTruthy());
  });

  it("archives a restaurant successfully", async () => {
    (adminGetRestaurants as jest.Mock).mockResolvedValue([{ id: 1, name: "Resto 1" }]);
    (adminSetRestaurantArchived as jest.Mock).mockResolvedValue(true);
    renderWithProviders(<AdminSettingsScreen />);
    await waitFor(() => expect(screen.getByText("Archive / Delete Location")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive / Delete Location"));
    await waitFor(() =>
      expect(screen.getByText("Select a location above to see options.")).toBeTruthy()
    );
    const restoPills = screen.getAllByText("Resto 1");
    fireEvent.press(restoPills[restoPills.length - 1]);
    await waitFor(() => expect(screen.getByText("Archive…")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Archive…"));
    });
    expect(adminSetRestaurantArchived).toHaveBeenCalledWith(1, true);
  });

  it("shows archive error when archiving fails", async () => {
    (adminGetRestaurants as jest.Mock).mockResolvedValue([{ id: 1, name: "Resto 1" }]);
    (adminSetRestaurantArchived as jest.Mock).mockResolvedValue(false);
    renderWithProviders(<AdminSettingsScreen />);
    await waitFor(() => expect(screen.getByText("Archive / Delete Location")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive / Delete Location"));
    await waitFor(() =>
      expect(screen.getByText("Select a location above to see options.")).toBeTruthy()
    );
    const restoPills = screen.getAllByText("Resto 1");
    fireEvent.press(restoPills[restoPills.length - 1]);
    await waitFor(() => expect(screen.getByText("Archive…")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Archive…"));
    });
    await waitFor(() => expect(screen.getByText("Failed. Please try again.")).toBeTruthy());
  });

  it("restores an archived restaurant successfully", async () => {
    (fetchRestaurants as jest.Mock).mockResolvedValue([]);
    (adminGetRestaurants as jest.Mock).mockResolvedValue([
      { id: 1, name: "Resto 1", isArchived: true },
    ]);
    (adminSetRestaurantArchived as jest.Mock).mockResolvedValue(true);
    (fetchRestaurants as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ id: 1, name: "Resto 1", sections: [] }]);
    renderWithProviders(<AdminSettingsScreen />);
    await waitFor(() => expect(screen.getByText("Archive / Delete Location")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive / Delete Location"));
    await waitFor(() =>
      expect(screen.getByText("Select a location above to see options.")).toBeTruthy()
    );
    const restoPills = screen.getAllByText("Resto 1");
    fireEvent.press(restoPills[restoPills.length - 1]);
    await waitFor(() => expect(screen.getByText("Restore")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Restore"));
    });
    expect(adminSetRestaurantArchived).toHaveBeenCalledWith(1, false);
  });

  it("moves to delete confirm step and cancels", async () => {
    (adminGetRestaurants as jest.Mock).mockResolvedValue([{ id: 1, name: "Resto 1" }]);
    renderWithProviders(<AdminSettingsScreen />);
    await waitFor(() => expect(screen.getByText("Archive / Delete Location")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive / Delete Location"));
    await waitFor(() =>
      expect(screen.getByText("Select a location above to see options.")).toBeTruthy()
    );
    const restoPills = screen.getAllByText("Resto 1");
    fireEvent.press(restoPills[restoPills.length - 1]);
    await waitFor(() => expect(screen.getByText("Delete…")).toBeTruthy());
    fireEvent.press(screen.getByText("Delete…"));
    await waitFor(() => expect(screen.getByText("Yes, delete permanently")).toBeTruthy());
    fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() => expect(screen.queryByText("Yes, delete permanently")).toBeNull());
  });

  it("deletes a restaurant successfully", async () => {
    (adminGetRestaurants as jest.Mock).mockResolvedValue([{ id: 1, name: "Resto 1" }]);
    (adminDeleteRestaurant as jest.Mock).mockResolvedValue(true);
    renderWithProviders(<AdminSettingsScreen />);
    await waitFor(() => expect(screen.getByText("Archive / Delete Location")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive / Delete Location"));
    await waitFor(() =>
      expect(screen.getByText("Select a location above to see options.")).toBeTruthy()
    );
    const restoPills = screen.getAllByText("Resto 1");
    fireEvent.press(restoPills[restoPills.length - 1]);
    await waitFor(() => expect(screen.getByText("Delete…")).toBeTruthy());
    fireEvent.press(screen.getByText("Delete…"));
    await waitFor(() => expect(screen.getByText("Yes, delete permanently")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Yes, delete permanently"));
    });
    expect(adminDeleteRestaurant).toHaveBeenCalledWith(1);
  });

  it("shows delete error when deletion fails", async () => {
    (adminGetRestaurants as jest.Mock).mockResolvedValue([{ id: 1, name: "Resto 1" }]);
    (adminDeleteRestaurant as jest.Mock).mockResolvedValue(false);
    renderWithProviders(<AdminSettingsScreen />);
    await waitFor(() => expect(screen.getByText("Archive / Delete Location")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive / Delete Location"));
    await waitFor(() =>
      expect(screen.getByText("Select a location above to see options.")).toBeTruthy()
    );
    const restoPills = screen.getAllByText("Resto 1");
    fireEvent.press(restoPills[restoPills.length - 1]);
    await waitFor(() => expect(screen.getByText("Delete…")).toBeTruthy());
    fireEvent.press(screen.getByText("Delete…"));
    await waitFor(() => expect(screen.getByText("Yes, delete permanently")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Yes, delete permanently"));
    });
    await waitFor(() =>
      expect(screen.getByText("Failed to delete. Please try again.")).toBeTruthy()
    );
  });

  it("selects a different location pill to update settings", async () => {
    const twoRestaurants = [
      { id: 1, name: "Resto 1", sections: [] },
      { id: 2, name: "Resto 2", sections: [] },
    ];
    (fetchRestaurants as jest.Mock).mockResolvedValue(twoRestaurants);
    (adminGetRestaurants as jest.Mock).mockResolvedValue(twoRestaurants);
    renderWithProviders(<AdminSettingsScreen />);
    await waitFor(() => expect(screen.getByText("Resto 2")).toBeTruthy());
    fireEvent.press(screen.getByText("Resto 2"));
    expect(screen.getByText("Resto 2")).toBeTruthy();
  });
});
