/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, waitFor, fireEvent, act } from "@testing-library/react-native";
import AdminLocationsScreen from "@/app/admin/locations";
import { fetchRestaurants, createRestaurant, fetchScheduleConflicts } from "@/api/restaurants";
import {
  adminGetRestaurants,
  adminDeleteRestaurant,
  adminGetRestaurantDeletePreview,
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
  adminGetRestaurantDeletePreview: jest.fn(),
  adminSetRestaurantArchived: jest.fn(),
  pauseRestaurantBookings: jest.fn(),
  unpauseRestaurantBookings: jest.fn(),
  extendRestaurantBookings: jest.fn(),
}));
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: mockPush }),
}));
jest.mock("@/api/auth", () => ({
  checkSession: jest.fn(),
  logout: jest.fn(),
}));

jest.mock("@/components/admin/bookings/BookingDetailPopup", () => ({
  BookingDetailPopup: ({ bookingId }: any) => {
    const { View, Text } = require("react-native");
    return bookingId == null ? null : (
      <View testID="booking-popup">
        <Text>{`booking ${bookingId}`}</Text>
      </View>
    );
  },
}));

jest.mock("@/components/admin/settings/LocationCard", () => ({
  LocationCard: ({ onSaved }: any) => {
    const { View, Pressable, Text } = require("react-native");
    return (
      <View>
        <Pressable testID="trigger-save" onPress={() => onSaved?.({ name: "Patched Name" })}>
          <Text>Save</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.setTimeout(15000);

const signedInAs = (role: string) =>
  (require("@/api/auth").checkSession as jest.Mock).mockResolvedValue({
    id: 1,
    email: "admin@test.com",
    displayName: null,
    role,
  });

const renderScreen = () => renderWithProviders(<AdminLocationsScreen />, { withAuth: true });

describe("AdminLocationsScreen", () => {
  const mockRestaurants = [{ id: 1, name: "Resto 1", sections: [], activeBookingsCount: 2 }];

  beforeEach(() => {
    jest.clearAllMocks();
    signedInAs("Owner");
    (fetchScheduleConflicts as jest.Mock).mockResolvedValue([]);
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    (adminGetRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    (pauseRestaurantBookings as jest.Mock).mockResolvedValue(true);
    (unpauseRestaurantBookings as jest.Mock).mockResolvedValue(true);
    (extendRestaurantBookings as jest.Mock).mockResolvedValue({ ok: true, extendedBookings: [] });
  });

  it("renders locations after loading", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText("1 active")).toBeTruthy());
  });

  it("counts archived locations separately in the header", async () => {
    (adminGetRestaurants as jest.Mock).mockResolvedValue([
      { id: 1, name: "Resto 1" },
      { id: 2, name: "Resto 2", isArchived: true },
    ]);
    renderScreen();
    await waitFor(() => expect(screen.getByText("1 active · 1 archived")).toBeTruthy());
  });

  it("handles empty locations list", async () => {
    (fetchRestaurants as jest.Mock).mockResolvedValue([]);
    (adminGetRestaurants as jest.Mock).mockResolvedValue([]);
    renderScreen();
    await waitFor(() => expect(screen.getByText("No locations yet")).toBeTruthy());
  });

  it("patches restaurant when LocationCard onSaved is triggered", async () => {
    renderScreen();
    await waitFor(() => screen.getByTestId("trigger-save"));
    fireEvent.press(screen.getByTestId("trigger-save"));
    await waitFor(() => expect(screen.queryByText("Patched Name")).toBeTruthy());
  });

  it("shows add location form when Add location is pressed", async () => {
    renderScreen();
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
    renderScreen();
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
    // The new location joins the one selector, so its pill is selectable immediately.
    await waitFor(() => expect(screen.getByText("2 active")).toBeTruthy());
  });

  it("closes add location form when createRestaurant fails", async () => {
    (createRestaurant as jest.Mock).mockResolvedValue(null);
    renderScreen();
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

  it("closes the add location form on cancel", async () => {
    renderScreen();
    await waitFor(() => screen.getByText("Add location"));
    fireEvent.press(screen.getByText("Add location"));
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Location name (e.g. Downtown, Westside)")).toBeTruthy()
    );
    fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() =>
      expect(screen.queryByPlaceholderText("Location name (e.g. Downtown, Westside)")).toBeNull()
    );
  });

  it("shows location pills without requiring any toggle", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText("Resto 1")).toBeTruthy());
  });

  it("shows 0 locations configured when empty", async () => {
    (fetchRestaurants as jest.Mock).mockResolvedValue([]);
    (adminGetRestaurants as jest.Mock).mockResolvedValue([]);
    renderScreen();
    await waitFor(() => expect(screen.getByText("No locations configured")).toBeTruthy());
  });

  it("selects a different location pill to update settings", async () => {
    const twoRestaurants = [
      { id: 1, name: "Resto 1", sections: [] },
      { id: 2, name: "Resto 2", sections: [] },
    ];
    (fetchRestaurants as jest.Mock).mockResolvedValue(twoRestaurants);
    (adminGetRestaurants as jest.Mock).mockResolvedValue(twoRestaurants);
    renderScreen();
    await waitFor(() => expect(screen.getByText("Resto 2")).toBeTruthy());
    fireEvent.press(screen.getByText("Resto 2"));
    expect(screen.getByText("Resto 2")).toBeTruthy();
  });

  it("renders booking action buttons when a location is selected", async () => {
    renderScreen();
    await waitFor(() =>
      expect(screen.getByText("Pause New Bookings for the next 60m")).toBeTruthy()
    );
    expect(screen.getByText("Extend 2 active Bookings by 60m")).toBeTruthy();
  });

  it("shows disabled No active bookings button when there are no active bookings", async () => {
    (adminGetRestaurants as jest.Mock).mockResolvedValue([
      { id: 1, name: "Resto 1", sections: [], activeBookingsCount: 0 },
    ]);
    renderScreen();
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
    renderScreen();
    await waitFor(() => expect(screen.getByText(/Resume New Bookings now/)).toBeTruthy());
  });

  it("pauses bookings when Pause New Bookings for the next 60m is pressed", async () => {
    renderScreen();
    await waitFor(() =>
      expect(screen.getByText("Pause New Bookings for the next 60m")).toBeTruthy()
    );
    await act(async () => {
      fireEvent.press(screen.getByText("Pause New Bookings for the next 60m"));
    });
    expect(pauseRestaurantBookings).toHaveBeenCalledWith(1, 60);
  });

  it("resumes bookings when Resume button is pressed", async () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    (adminGetRestaurants as jest.Mock).mockResolvedValue([
      { id: 1, name: "Resto 1", bookingsPausedUntil: futureDate },
    ]);
    renderScreen();
    await waitFor(() => expect(screen.getByText(/Resume New Bookings now/)).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText(/Resume New Bookings now/));
    });
    expect(unpauseRestaurantBookings).toHaveBeenCalledWith(1);
  });

  it("shows No active bookings to extend when extend returns empty", async () => {
    (extendRestaurantBookings as jest.Mock).mockResolvedValue({ ok: true, extendedBookings: [] });
    renderScreen();
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
    renderScreen();
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
    renderScreen();
    await waitFor(() => expect(screen.getByText("Extend 2 active Bookings by 60m")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Extend 2 active Bookings by 60m"));
    });
    await waitFor(() => expect(screen.getByText("Extended 1 active bookings +60m")).toBeTruthy());
    fireEvent.press(screen.getByText("Resto 2"));
    await waitFor(() => expect(screen.getByText("Extend 2 active Bookings by 60m")).toBeTruthy());
  });
});

describe("AdminLocationsScreen archive and delete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    signedInAs("Owner");
    (fetchScheduleConflicts as jest.Mock).mockResolvedValue([]);
    (fetchRestaurants as jest.Mock).mockResolvedValue([
      { id: 1, name: "Resto 1", sections: [], activeBookingsCount: 0 },
    ]);
    (adminGetRestaurants as jest.Mock).mockResolvedValue([{ id: 1, name: "Resto 1" }]);
    (adminSetRestaurantArchived as jest.Mock).mockResolvedValue(true);
    (extendRestaurantBookings as jest.Mock).mockResolvedValue({ ok: true, extendedBookings: [] });
  });

  const archivedOnly = () => {
    (fetchRestaurants as jest.Mock).mockResolvedValue([]);
    (adminGetRestaurants as jest.Mock).mockResolvedValue([
      { id: 1, name: "Resto 1", isArchived: true },
    ]);
  };

  it("archives the selected location after confirming", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText("Archive")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive"));
    await waitFor(() => expect(screen.getByText("Archive Resto 1?")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Yes, archive"));
    });
    expect(adminSetRestaurantArchived).toHaveBeenCalledWith(1, true);
  });

  it("does not archive when the confirmation is cancelled", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText("Archive")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive"));
    await waitFor(() => expect(screen.getByText("Archive Resto 1?")).toBeTruthy());
    fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() => expect(screen.queryByText("Archive Resto 1?")).toBeNull());
    expect(adminSetRestaurantArchived).not.toHaveBeenCalled();
  });

  it("names the upcoming bookings the archive would take off the site", async () => {
    (adminGetRestaurants as jest.Mock).mockResolvedValue([
      { id: 1, name: "Resto 1", upcomingBookingsCount: 3 },
    ]);
    renderScreen();
    await waitFor(() => expect(screen.getByText("Archive")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive"));
    await waitFor(() => expect(screen.getByText(/3 upcoming bookings/)).toBeTruthy());
  });

  it("phrases a single upcoming booking in the singular", async () => {
    (adminGetRestaurants as jest.Mock).mockResolvedValue([
      { id: 1, name: "Resto 1", upcomingBookingsCount: 1 },
    ]);
    renderScreen();
    await waitFor(() => expect(screen.getByText("Archive")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive"));
    await waitFor(() => expect(screen.getByText(/1 upcoming booking stay/)).toBeTruthy());
  });

  it("reports progress while archiving and restoring", async () => {
    (adminSetRestaurantArchived as jest.Mock).mockReturnValue(new Promise(() => {}));
    const { unmount } = renderScreen();
    await waitFor(() => expect(screen.getByText("Archive")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive"));
    await waitFor(() => expect(screen.getByText("Yes, archive")).toBeTruthy());
    fireEvent.press(screen.getByText("Yes, archive"));
    await waitFor(() => expect(screen.getByText("Archiving…")).toBeTruthy());
    unmount();

    archivedOnly();
    renderScreen();
    await waitFor(() => expect(screen.getByText("Restore")).toBeTruthy());
    fireEvent.press(screen.getByText("Restore"));
    await waitFor(() => expect(screen.getByText("Restoring…")).toBeTruthy());
  });

  it("surfaces an archive failure", async () => {
    (adminSetRestaurantArchived as jest.Mock).mockResolvedValue(false);
    renderScreen();
    await waitFor(() => expect(screen.getByText("Archive")).toBeTruthy());
    fireEvent.press(screen.getByText("Archive"));
    await waitFor(() => expect(screen.getByText("Archive Resto 1?")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Yes, archive"));
    });
    await waitFor(() =>
      expect(screen.getByText("Failed to archive. Please try again.")).toBeTruthy()
    );
  });

  it("shows the archived panel with a restore action and no editable card", async () => {
    archivedOnly();
    renderScreen();
    await waitFor(() => expect(screen.getByText("Archived")).toBeTruthy());
    expect(screen.queryByTestId("trigger-save")).toBeNull();
    expect(screen.queryByText("Archive")).toBeNull();
  });

  it("restores an archived location in one press", async () => {
    archivedOnly();
    renderScreen();
    await waitFor(() => expect(screen.getByText("Restore")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Restore"));
    });
    expect(adminSetRestaurantArchived).toHaveBeenCalledWith(1, false);
  });

  it("surfaces a restore failure", async () => {
    archivedOnly();
    (adminSetRestaurantArchived as jest.Mock).mockResolvedValue(false);
    renderScreen();
    await waitFor(() => expect(screen.getByText("Restore")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Restore"));
    });
    await waitFor(() =>
      expect(screen.getByText("Failed to restore. Please try again.")).toBeTruthy()
    );
  });

  it("offers delete only on an archived location", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText("Archive")).toBeTruthy());
    expect(screen.queryByText("Delete…")).toBeNull();
  });

  it("hides delete from a Manager", async () => {
    archivedOnly();
    signedInAs("Manager");
    renderScreen();
    await waitFor(() => expect(screen.getByText("Restore")).toBeTruthy());
    expect(screen.queryByText("Delete…")).toBeNull();
  });

  it("deletes an archived location once its name is typed", async () => {
    archivedOnly();
    (adminGetRestaurantDeletePreview as jest.Mock).mockResolvedValue({
      id: 1,
      name: "Resto 1",
      isArchived: true,
      sectionCount: 2,
      tableCount: 8,
      tableGroupCount: 1,
      bookingCount: 40,
      upcomingBookingCount: 3,
    });
    (adminDeleteRestaurant as jest.Mock).mockResolvedValue(true);
    renderScreen();
    await waitFor(() => expect(screen.getByText("Delete…")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Delete…"));
    });
    await waitFor(() => expect(screen.getByText("40 bookings, 3 still upcoming")).toBeTruthy());
    expect(adminGetRestaurantDeletePreview).toHaveBeenCalledWith(1);
    expect(screen.getByText("1 combinable group")).toBeTruthy();

    // The destroy button is inert until the name matches.
    fireEvent.press(screen.getByText("Delete permanently"));
    expect(adminDeleteRestaurant).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId("delete-location-name-input"), "resto 1");
    await act(async () => {
      fireEvent.press(screen.getByText("Delete permanently"));
    });
    expect(adminDeleteRestaurant).toHaveBeenCalledWith(1);
    await waitFor(() => expect(screen.getByText("Resto 1 was permanently deleted.")).toBeTruthy());
  });

  it("closes the delete modal without deleting when cancelled", async () => {
    archivedOnly();
    (adminGetRestaurantDeletePreview as jest.Mock).mockResolvedValue(null);
    renderScreen();
    await waitFor(() => expect(screen.getByText("Delete…")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Delete…"));
    });
    await waitFor(() => expect(screen.getByTestId("delete-location-name-input")).toBeTruthy());
    fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() => expect(screen.queryByTestId("delete-location-name-input")).toBeNull());
    expect(adminDeleteRestaurant).not.toHaveBeenCalled();
  });

  it("keeps the modal open and reports a failed delete", async () => {
    archivedOnly();
    (adminGetRestaurantDeletePreview as jest.Mock).mockResolvedValue(null);
    (adminDeleteRestaurant as jest.Mock).mockResolvedValue(false);
    renderScreen();
    await waitFor(() => expect(screen.getByText("Delete…")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Delete…"));
    });
    await waitFor(() => expect(screen.getByTestId("delete-location-name-input")).toBeTruthy());
    fireEvent.changeText(screen.getByTestId("delete-location-name-input"), "Resto 1");
    await act(async () => {
      fireEvent.press(screen.getByText("Delete permanently"));
    });
    await waitFor(() =>
      expect(screen.getByText("Failed to delete. Please try again.")).toBeTruthy()
    );
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
    signedInAs("Owner");
    (fetchScheduleConflicts as jest.Mock).mockResolvedValue([]);
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
    renderScreen();
    await waitFor(() => expect(screen.getByText("Resto 1")).toBeTruthy());
    // Persisted value (2) was honoured, not overwritten to the first restaurant (1).
    expect(JSON.parse(localStorage.getItem("locations:selectedId") as string)).toBe(2);
  });

  it("falls back to the first restaurant when the persisted id no longer exists", async () => {
    localStorage.setItem("locations:selectedId", JSON.stringify(999));
    renderScreen();
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("locations:selectedId") as string)).toBe(1)
    );
  });

  it("writes the selected id to localStorage when a location pill is pressed", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText("Resto 2")).toBeTruthy());
    fireEvent.press(screen.getByText("Resto 2"));
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("locations:selectedId") as string)).toBe(2)
    );
  });

  it("keeps an archived location selectable from the one pill row", async () => {
    (fetchRestaurants as jest.Mock).mockResolvedValue([twoRestaurants[0]]);
    (adminGetRestaurants as jest.Mock).mockResolvedValue([
      { id: 1, name: "Resto 1" },
      { id: 2, name: "Resto 2", isArchived: true },
    ]);
    renderScreen();
    await waitFor(() => expect(screen.getByText("Resto 2")).toBeTruthy());
    fireEvent.press(screen.getByText("Resto 2"));
    await waitFor(() => expect(screen.getByText("Archived")).toBeTruthy());
  });

  // The panel used to route to /admin/bookings with the ref as a search term, which left the
  // location being edited and made the admin search for a booking it already had in hand.
  it("opens a stranded booking in the popup instead of leaving for the bookings list", async () => {
    (fetchScheduleConflicts as jest.Mock).mockResolvedValue([
      {
        bookingId: 42,
        bookingRef: "crispy-basil-truffle",
        customerName: "Ada Lovelace",
        date: "2026-09-02T10:00:00Z",
        seats: 2,
        reason: "outsideHours",
      },
    ]);

    renderScreen();
    await waitFor(() => expect(screen.getByTestId("schedule-conflicts-panel")).toBeTruthy());
    expect(screen.queryByTestId("booking-popup")).toBeNull();

    fireEvent.press(screen.getByLabelText("Open booking crispy-basil-truffle"));

    await waitFor(() => expect(screen.getByText("booking 42")).toBeTruthy());
    expect(mockPush).not.toHaveBeenCalled();
  });
});
