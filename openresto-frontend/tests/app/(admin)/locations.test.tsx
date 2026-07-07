/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, waitFor, fireEvent, act } from "@testing-library/react-native";
import AdminLocationsScreen from "@/app/(admin)/locations";
import { fetchRestaurants, createRestaurant } from "@/api/restaurants";
import {
  adminGetRestaurants,
  adminDeleteRestaurant,
  adminSetRestaurantArchived,
  pauseRestaurantBookings,
  unpauseRestaurantBookings,
  extendRestaurantBookings,
} from "@/api/admin";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

jest.mock("@/api/restaurants");
jest.mock("@/api/admin", () => ({
  adminGetRestaurants: jest.fn(),
  adminDeleteRestaurant: jest.fn(),
  adminSetRestaurantArchived: jest.fn(),
  pauseRestaurantBookings: jest.fn(),
  unpauseRestaurantBookings: jest.fn(),
  extendRestaurantBookings: jest.fn(),
}));
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
}));

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

jest.setTimeout(15000);

describe("AdminLocationsScreen", () => {
  const mockRestaurants = [{ id: 1, name: "Resto 1", sections: [], activeBookingsCount: 2 }];

  beforeEach(() => {
    jest.clearAllMocks();
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    (adminGetRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    (pauseRestaurantBookings as jest.Mock).mockResolvedValue(true);
    (unpauseRestaurantBookings as jest.Mock).mockResolvedValue(true);
    (extendRestaurantBookings as jest.Mock).mockResolvedValue({ ok: true, extendedBookings: [] });
  });

  it("renders locations after loading", async () => {
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.queryByText(/1 location/)).toBeTruthy());
  });

  it("handles empty locations list", async () => {
    (fetchRestaurants as jest.Mock).mockResolvedValue([]);
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText("No locations yet")).toBeTruthy());
  });

  it("patches restaurant when LocationCard onSaved is triggered", async () => {
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => screen.getByTestId("trigger-save"));
    fireEvent.press(screen.getByTestId("trigger-save"));
    await waitFor(() => expect(screen.queryByText("Patched Name")).toBeTruthy());
  });

  it("shows add location form when Add location is pressed", async () => {
    renderWithProviders(<AdminLocationsScreen />);
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
    renderWithProviders(<AdminLocationsScreen />);
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
    renderWithProviders(<AdminLocationsScreen />);
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
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => screen.getByTestId("trigger-confirm"));

    fireEvent.press(screen.getByTestId("trigger-confirm"));
    expect(screen.getByText("Test Message")).toBeTruthy();

    fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() => expect(screen.queryByText("Test Message")).toBeNull());

    fireEvent.press(screen.getByTestId("trigger-confirm"));
    fireEvent.press(screen.getByText("Delete"));
    await waitFor(() => expect(screen.queryByText("Test Message")).toBeNull());
  });

  it("shows location pills without requiring any toggle", async () => {
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText("Resto 1")).toBeTruthy());
  });

  it("shows 0 locations configured when empty", async () => {
    (fetchRestaurants as jest.Mock).mockResolvedValue([]);
    (adminGetRestaurants as jest.Mock).mockResolvedValue([]);
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText("No locations configured")).toBeTruthy());
  });

  it("expands danger zone and shows select-a-location placeholder", async () => {
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText("Archive or delete a location")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive or delete a location"));
    await waitFor(() =>
      expect(screen.getByText("Select a location above to see options.")).toBeTruthy()
    );
  });

  it("collapses danger zone and resets step", async () => {
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText("Archive or delete a location")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive or delete a location"));
    await waitFor(() =>
      expect(screen.getByText("Select a location above to see options.")).toBeTruthy()
    );
    fireEvent.press(screen.getByText("Archive or delete a location"));
    await waitFor(() =>
      expect(screen.queryByText("Select a location above to see options.")).toBeNull()
    );
  });

  it("selects a location in the danger zone", async () => {
    (adminGetRestaurants as jest.Mock).mockResolvedValue([{ id: 1, name: "Resto 1" }]);
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText("Archive or delete a location")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive or delete a location"));
    await waitFor(() =>
      expect(screen.getByText("Select a location above to see options.")).toBeTruthy()
    );
    const restoPills = screen.getAllByText("Resto 1");
    fireEvent.press(restoPills[restoPills.length - 1]);
    await waitFor(() => expect(screen.getByText("Archive Location")).toBeTruthy());
  });

  it("archives a restaurant successfully", async () => {
    (adminGetRestaurants as jest.Mock).mockResolvedValue([{ id: 1, name: "Resto 1" }]);
    (adminSetRestaurantArchived as jest.Mock).mockResolvedValue(true);
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText("Archive or delete a location")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive or delete a location"));
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
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText("Archive or delete a location")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive or delete a location"));
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
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText("Archive or delete a location")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive or delete a location"));
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
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText("Archive or delete a location")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive or delete a location"));
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
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText("Archive or delete a location")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive or delete a location"));
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
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText("Archive or delete a location")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive or delete a location"));
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
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText("Resto 2")).toBeTruthy());
    fireEvent.press(screen.getByText("Resto 2"));
    expect(screen.getByText("Resto 2")).toBeTruthy();
  });

  it("renders booking action buttons when a location is selected", async () => {
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText("Pause New Bookings for 60m")).toBeTruthy());
    expect(screen.getByText("Extend 2 active Bookings by 60m")).toBeTruthy();
  });

  it("shows disabled No active bookings button when there are no active bookings", async () => {
    (adminGetRestaurants as jest.Mock).mockResolvedValue([
      { id: 1, name: "Resto 1", sections: [], activeBookingsCount: 0 },
    ]);
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText("No active bookings")).toBeTruthy());
    // Button must not call the API when disabled
    fireEvent.press(screen.getByText("No active bookings"));
    expect(extendRestaurantBookings).not.toHaveBeenCalled();
  });

  it("shows Resume button when restaurant is paused", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    (adminGetRestaurants as jest.Mock).mockResolvedValue([
      { id: 1, name: "Resto 1", bookingsPausedUntil: futureDate },
    ]);
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText(/Resume New Bookings now/)).toBeTruthy());
  });

  it("pauses bookings when Pause New Bookings for 60m is pressed", async () => {
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText("Pause New Bookings for 60m")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Pause New Bookings for 60m"));
    });
    expect(pauseRestaurantBookings).toHaveBeenCalledWith(1, 60);
  });

  it("resumes bookings when Resume button is pressed", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    (adminGetRestaurants as jest.Mock).mockResolvedValue([
      { id: 1, name: "Resto 1", bookingsPausedUntil: futureDate },
    ]);
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText(/Resume New Bookings now/)).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText(/Resume New Bookings now/));
    });
    expect(unpauseRestaurantBookings).toHaveBeenCalledWith(1);
  });

  it("shows No active bookings to extend when extend returns empty", async () => {
    (extendRestaurantBookings as jest.Mock).mockResolvedValue({ ok: true, extendedBookings: [] });
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText("Extend 2 active Bookings by 60m")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Extend 2 active Bookings by 60m"));
    });
    await waitFor(() => expect(screen.getByText("No active bookings to extend")).toBeTruthy());
  });

  it("shows extended count on button after extend succeeds and locks it", async () => {
    (extendRestaurantBookings as jest.Mock).mockResolvedValue({
      ok: true,
      extendedBookings: [
        {
          id: 10,
          restaurantId: 1,
          restaurantName: "Resto 1",
          sectionId: null,
          sectionName: "",
          tableId: null,
          tableName: "",
          date: new Date().toISOString(),
          endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          customerEmail: "alice@example.com",
          customerName: "Alice",
          seats: 2,
        },
      ],
    });
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText("Extend 2 active Bookings by 60m")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Extend 2 active Bookings by 60m"));
    });
    await waitFor(() => expect(screen.getByText("Extended 1 active bookings +60m")).toBeTruthy());
    expect(extendRestaurantBookings).toHaveBeenCalledWith(1, 60);
    // Pressing again must not re-extend (button is locked)
    fireEvent.press(screen.getByText("Extended 1 active bookings +60m"));
    expect(extendRestaurantBookings).toHaveBeenCalledTimes(1);
  });

  it("resets extend state when switching locations", async () => {
    const twoRestaurants = [
      { id: 1, name: "Resto 1", sections: [], activeBookingsCount: 2 },
      { id: 2, name: "Resto 2", sections: [], activeBookingsCount: 2 },
    ];
    (fetchRestaurants as jest.Mock).mockResolvedValue(twoRestaurants);
    (adminGetRestaurants as jest.Mock).mockResolvedValue(twoRestaurants);
    (extendRestaurantBookings as jest.Mock).mockResolvedValue({
      ok: true,
      extendedBookings: [
        {
          id: 10,
          restaurantId: 1,
          restaurantName: "Resto 1",
          sectionId: null,
          sectionName: "",
          tableId: null,
          tableName: "",
          date: new Date().toISOString(),
          endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          customerEmail: "alice@example.com",
          customerName: "Alice",
          seats: 2,
        },
      ],
    });
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText("Extend 2 active Bookings by 60m")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Extend 2 active Bookings by 60m"));
    });
    await waitFor(() => expect(screen.getByText("Extended 1 active bookings +60m")).toBeTruthy());
    fireEvent.press(screen.getByText("Resto 2"));
    await waitFor(() => expect(screen.getByText("Extend 2 active Bookings by 60m")).toBeTruthy());
  });
});

describe("AdminLocationsScreen selected-location persistence", () => {
  const { Platform } = require("react-native");
  const originalPlatform = Platform.OS;
  const twoRestaurants = [
    { id: 1, name: "Resto 1", sections: [], activeBookingsCount: 0 },
    { id: 2, name: "Resto 2", sections: [], activeBookingsCount: 0 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
    localStorage.clear();
    (fetchRestaurants as jest.Mock).mockResolvedValue(twoRestaurants);
    (adminGetRestaurants as jest.Mock).mockResolvedValue(twoRestaurants);
    (pauseRestaurantBookings as jest.Mock).mockResolvedValue(true);
    (unpauseRestaurantBookings as jest.Mock).mockResolvedValue(true);
    (extendRestaurantBookings as jest.Mock).mockResolvedValue({ ok: true, extendedBookings: [] });
  });

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { value: originalPlatform, configurable: true });
  });

  it("honours a persisted selected-location id on mount", async () => {
    localStorage.setItem("locations:selectedId", JSON.stringify(2));
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText("Resto 1")).toBeTruthy());
    // Persisted value (2) was honoured, not overwritten to the first restaurant (1).
    expect(JSON.parse(localStorage.getItem("locations:selectedId") as string)).toBe(2);
  });

  it("falls back to the first restaurant when the persisted id no longer exists", async () => {
    localStorage.setItem("locations:selectedId", JSON.stringify(999));
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("locations:selectedId") as string)).toBe(1)
    );
  });

  it("writes the selected id to localStorage when a location pill is pressed", async () => {
    renderWithProviders(<AdminLocationsScreen />);
    await waitFor(() => expect(screen.getByText("Resto 2")).toBeTruthy());
    fireEvent.press(screen.getByText("Resto 2"));
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("locations:selectedId") as string)).toBe(2)
    );
  });
});
