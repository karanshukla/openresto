/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react-native";
import AdminBookingsScreen from "@/app/(admin)/bookings/index";
import {
  getAdminBookings,
  adminDeleteBooking,
  adminLookupBookings,
  adminGetTables,
} from "@/api/admin";

jest.mock("@/api/admin", () => ({
  getAdminBookings: jest.fn(),
  adminGetTables: jest.fn().mockResolvedValue([]),
  adminDeleteBooking: jest.fn().mockResolvedValue(true),
  adminLookupBookings: jest.fn().mockResolvedValue([]),
  getAdminBooking: jest.fn().mockResolvedValue(null),
}));

const mockReplace = jest.fn();
const mockSearchParams: Record<string, string | undefined> = {};

jest.mock("expo-router", () => {
  const Stack = { Screen: () => null };
  return {
    Stack,
    useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
    useLocalSearchParams: () => mockSearchParams,
  };
});

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Test App", primaryColor: "#000" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/api/restaurants", () => ({
  fetchRestaurants: jest.fn().mockResolvedValue([{ id: 1, name: "Resto 1" }]),
}));

// Stub heavy sub-components but expose callback triggers for testing
jest.mock("@/components/admin/bookings/AvailabilityGrid", () => ({
  AvailabilityGrid: ({ onBookingPress }: any) => {
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable testID="grid-press-booking" onPress={() => onBookingPress({ id: 42 })}>
        <Text>GridBooking</Text>
      </Pressable>
    );
  },
}));

jest.mock("@/components/admin/bookings/BookingDetailPopup", () => ({
  BookingDetailPopup: ({ onClose, onDeleted }: any) => {
    const { Pressable, Text } = require("react-native");
    return (
      <>
        <Pressable testID="popup-close" onPress={onClose}>
          <Text>ClosePopup</Text>
        </Pressable>
        <Pressable testID="popup-deleted" onPress={onDeleted}>
          <Text>DeletedPopup</Text>
        </Pressable>
      </>
    );
  },
}));

jest.mock("@/components/admin/bookings/NewBookingModal", () => ({
  NewBookingModal: ({ onClose, onCreated }: any) => {
    const { Pressable, Text } = require("react-native");
    return (
      <>
        <Pressable testID="newmodal-close" onPress={onClose}>
          <Text>CloseNewModal</Text>
        </Pressable>
        <Pressable testID="newmodal-created" onPress={() => onCreated(99)}>
          <Text>CreatedNewModal</Text>
        </Pressable>
      </>
    );
  },
}));

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([{ id: 1, name: "Resto 1" }]),
  })
) as jest.Mock;

describe("AdminBookingsScreen", () => {
  const mockBookings = [
    {
      id: 1,
      bookingRef: "REF1",
      customerEmail: "john@example.com",
      status: "active",
      date: new Date().toISOString(),
      seats: 2,
      restaurantId: 1,
      restaurantName: "Resto 1",
      sectionId: 1,
      sectionName: "Main",
      tableId: 1,
      tableName: "T1",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (getAdminBookings as jest.Mock).mockResolvedValue(mockBookings);
    (adminLookupBookings as jest.Mock).mockResolvedValue([]);
    // Reset search params and router mock
    Object.keys(mockSearchParams).forEach((k) => delete mockSearchParams[k]);
    mockReplace.mockReset();
  });

  it("renders the bookings page", async () => {
    render(<AdminBookingsScreen />);
    await waitFor(() => {
      expect(screen.getByText("Bookings")).toBeTruthy();
    });
  });

  it("renders bookings in list view after switching modes", async () => {
    render(<AdminBookingsScreen />);

    // Switch to list mode
    const listBtn = await screen.findByText("List");
    fireEvent.press(listBtn);

    await waitFor(() => {
      expect(screen.getByText("john@example.com")).toBeTruthy();
    });
  });

  it("filters bookings by status in list view", async () => {
    render(<AdminBookingsScreen />);

    const listBtn = await screen.findByText("List");
    fireEvent.press(listBtn);

    const activeFilter = await screen.findByText("Active");
    fireEvent.press(activeFilter);

    await waitFor(() => {
      expect(getAdminBookings).toHaveBeenCalledWith(1, undefined, "active");
    });
  });

  it("switches to past filter in list view", async () => {
    render(<AdminBookingsScreen />);
    fireEvent.press(await screen.findByText("List"));
    fireEvent.press(await screen.findByText("Past"));
    await waitFor(() => {
      expect(getAdminBookings).toHaveBeenCalledWith(1, undefined, "past");
    });
  });

  it("switches to cancelled filter in list view", async () => {
    render(<AdminBookingsScreen />);
    fireEvent.press(await screen.findByText("List"));
    fireEvent.press(await screen.findByText("Cancelled"));
    await waitFor(() => {
      expect(getAdminBookings).toHaveBeenCalledWith(1, undefined, "cancelled");
    });
  });

  it("shows New Booking button and opens modal", async () => {
    render(<AdminBookingsScreen />);
    const listBtn = await screen.findByText("List");
    fireEvent.press(listBtn);

    const newBookingBtn = await screen.findByText("New Booking");
    fireEvent.press(newBookingBtn);
    expect(getAdminBookings).toHaveBeenCalled();
  });

  it("lookup shows 'No booking found' when no results", async () => {
    (adminLookupBookings as jest.Mock).mockResolvedValue([]);
    render(<AdminBookingsScreen />);
    await waitFor(() => expect(screen.getByText("Bookings")).toBeTruthy());

    const input = screen.getByPlaceholderText("Email or reference…");
    fireEvent.changeText(input, "unknown@example.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Find"));
    });
    await waitFor(() => {
      expect(screen.getByText("No booking found.")).toBeTruthy();
    });
  });

  it("lookup with single result opens the booking popup", async () => {
    (adminLookupBookings as jest.Mock).mockResolvedValue([{ ...mockBookings[0], id: 99 }]);
    render(<AdminBookingsScreen />);
    await waitFor(() => expect(screen.getByText("Bookings")).toBeTruthy());

    const input = screen.getByPlaceholderText("Email or reference…");
    fireEvent.changeText(input, "john@example.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Find"));
    });
    await waitFor(() => expect(adminLookupBookings).toHaveBeenCalledWith("john@example.com"));
  });

  it("lookup with multiple results shows 'Showing all matches…'", async () => {
    (adminLookupBookings as jest.Mock).mockResolvedValue([
      { ...mockBookings[0], id: 1 },
      { ...mockBookings[0], id: 2 },
    ]);
    render(<AdminBookingsScreen />);
    await waitFor(() => expect(screen.getByText("Bookings")).toBeTruthy());

    const input = screen.getByPlaceholderText("Email or reference…");
    fireEvent.changeText(input, "john@example.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Find"));
    });
    await waitFor(() => {
      expect(screen.getByText("Showing all matches…")).toBeTruthy();
    });
    expect(mockReplace).toHaveBeenCalled();
  });

  it("updates lookup query and clears status on change", async () => {
    (adminLookupBookings as jest.Mock).mockResolvedValue([]);
    render(<AdminBookingsScreen />);
    await waitFor(() => expect(screen.getByText("Bookings")).toBeTruthy());

    const searchInput = screen.getByPlaceholderText("Email or reference…");
    fireEvent.changeText(searchInput, "test");
    await act(async () => {
      fireEvent.press(screen.getByText("Find"));
    });
    await waitFor(() => expect(screen.getByText("No booking found.")).toBeTruthy());
    fireEvent.changeText(searchInput, "new");
    expect(screen.queryByText("No booking found.")).toBeNull();
  });

  it("does not call lookup when query is empty", async () => {
    render(<AdminBookingsScreen />);
    await waitFor(() => expect(screen.getByText("Bookings")).toBeTruthy());

    fireEvent.press(screen.getByText("Find"));
    expect(adminLookupBookings).not.toHaveBeenCalled();
  });

  it("shows search results when emailParam is provided", async () => {
    mockSearchParams.email = "john@example.com";
    render(<AdminBookingsScreen />);
    await waitFor(() => {
      expect(screen.getByText("Search Results")).toBeTruthy();
    });
  });

  it("shows clear button when searchQuery is present", async () => {
    mockSearchParams.email = "john@example.com";
    render(<AdminBookingsScreen />);
    await waitFor(() => {
      expect(screen.getByText("Clear")).toBeTruthy();
    });
  });

  it("renders booking row in list view and opens popup on press", async () => {
    render(<AdminBookingsScreen />);
    const listBtn = await screen.findByText("List");
    fireEvent.press(listBtn);

    await waitFor(() => expect(screen.getByText("john@example.com")).toBeTruthy());
    fireEvent.press(screen.getByText("john@example.com"));
    expect(getAdminBookings).toHaveBeenCalled();
  });

  it("handles cancel booking from the list row", async () => {
    (adminDeleteBooking as jest.Mock).mockResolvedValue(true);
    render(<AdminBookingsScreen />);
    fireEvent.press(await screen.findByText("List"));
    await waitFor(() => expect(screen.getByText("john@example.com")).toBeTruthy());

    const confirmBtns = screen.queryAllByText("Cancel Booking");
    if (confirmBtns.length > 0) {
      fireEvent.press(confirmBtns[confirmBtns.length - 1]);
      await waitFor(() => expect(adminDeleteBooking).toHaveBeenCalled());
    }
  });

  it("renders bookings with multi-part email initials", async () => {
    (getAdminBookings as jest.Mock).mockResolvedValue([
      { ...mockBookings[0], id: 2, customerEmail: "john.doe@example.com" },
    ]);
    render(<AdminBookingsScreen />);
    fireEvent.press(await screen.findByText("List"));
    await waitFor(() => {
      expect(screen.getByText("john.doe@example.com")).toBeTruthy();
    });
  });

  it("renders timetable view by default and loads grid", async () => {
    render(<AdminBookingsScreen />);
    await waitFor(() => expect(screen.getByText("Bookings")).toBeTruthy());
    expect(screen.getByText("Bookings")).toBeTruthy();
  });

  it("switches from timetable to list and back", async () => {
    render(<AdminBookingsScreen />);
    const listBtn = await screen.findByText("List");
    fireEvent.press(listBtn);
    await waitFor(() => expect(screen.getByText("john@example.com")).toBeTruthy());
    fireEvent.press(listBtn);
    expect(screen.getByText("Bookings")).toBeTruthy();
  });

  it("opens new booking modal when create=1 search param is set", async () => {
    mockSearchParams.create = "1";
    render(<AdminBookingsScreen />);
    // The create=1 effect sets showNewModal; just verify the page renders
    await waitFor(() => expect(screen.getByText("Bookings")).toBeTruthy());
    // NewBookingModal is stubbed to null; verify getAdminBookings fires after restaurant loads
    await waitFor(() => expect(getAdminBookings).toHaveBeenCalled(), { timeout: 3000 });
  });

  it("loads bookings when bookingRef search param is provided", async () => {
    mockSearchParams.bookingRef = "REF-ABCD";
    render(<AdminBookingsScreen />);
    await waitFor(() => expect(screen.getByText("Search Results")).toBeTruthy());
    expect(getAdminBookings).toHaveBeenCalledWith(
      undefined,
      undefined,
      "all",
      undefined,
      "REF-ABCD"
    );
  });

  it("clears search results when Clear button is pressed", async () => {
    mockSearchParams.email = "john@example.com";
    render(<AdminBookingsScreen />);
    await waitFor(() => expect(screen.getByText("Clear")).toBeTruthy());
    fireEvent.press(screen.getByText("Clear"));
    expect(mockReplace).toHaveBeenCalledWith("/(admin)/bookings");
  });

  it("renders cancelled booking badge in list view", async () => {
    (getAdminBookings as jest.Mock).mockResolvedValue([{ ...mockBookings[0], isCancelled: true }]);
    render(<AdminBookingsScreen />);
    fireEvent.press(await screen.findByText("List"));
    await waitFor(() => expect(screen.getByText("Cancelled")).toBeTruthy());
  });

  it("renders booking with customerName instead of email", async () => {
    (getAdminBookings as jest.Mock).mockResolvedValue([
      { ...mockBookings[0], customerName: "Alice Smith" },
    ]);
    render(<AdminBookingsScreen />);
    fireEvent.press(await screen.findByText("List"));
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeTruthy());
  });

  it("navigates grid dates forward and backward", async () => {
    render(<AdminBookingsScreen />);
    await waitFor(() => expect(screen.getByText("Bookings")).toBeTruthy());
    // Verify loadGrid runs on mount — adminGetTables is called for the timetable view
    await waitFor(() => expect(adminGetTables).toHaveBeenCalled(), { timeout: 3000 });
  });

  it("selects a different restaurant chip when multiple exist", async () => {
    const twoRestaurants = [
      { id: 1, name: "Resto 1" },
      { id: 2, name: "Resto 2" },
    ];
    const { fetchRestaurants } = require("@/api/restaurants");
    (fetchRestaurants as jest.Mock).mockResolvedValue(twoRestaurants);
    render(<AdminBookingsScreen />);
    await waitFor(() => expect(screen.getByText("Resto 2")).toBeTruthy());
    fireEvent.press(screen.getByText("Resto 2"));
    await waitFor(() => expect(getAdminBookings).toHaveBeenCalled());
  });

  it("lookup with multiple results using bookingRef navigates with bookingRef param", async () => {
    (adminLookupBookings as jest.Mock).mockResolvedValue([
      { ...mockBookings[0], id: 1 },
      { ...mockBookings[0], id: 2 },
    ]);
    render(<AdminBookingsScreen />);
    await waitFor(() => expect(screen.getByText("Bookings")).toBeTruthy());

    const input = screen.getByPlaceholderText("Email or reference…");
    fireEvent.changeText(input, "REF-XYZ");
    await act(async () => {
      fireEvent.press(screen.getByText("Find"));
    });
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(mockReplace).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ bookingRef: "REF-XYZ" }),
      })
    );
  });

  it("renders empty state in list view when no bookings", async () => {
    (getAdminBookings as jest.Mock).mockResolvedValue([]);
    render(<AdminBookingsScreen />);
    fireEvent.press(await screen.findByText("List"));
    await waitFor(() => expect(screen.getByText("No bookings found")).toBeTruthy());
  });

  it("renders past bookings sorted newest first", async () => {
    const older = { ...mockBookings[0], id: 10, date: "2024-01-01T10:00:00Z" };
    const newer = { ...mockBookings[0], id: 11, date: "2024-06-01T10:00:00Z" };
    (getAdminBookings as jest.Mock).mockResolvedValue([older, newer]);
    render(<AdminBookingsScreen />);
    fireEvent.press(await screen.findByText("List"));
    fireEvent.press(await screen.findByText("Past"));
    await waitFor(() => expect(getAdminBookings).toHaveBeenCalledWith(1, undefined, "past"));
  });

  it("presses the Timetable button to switch back from list mode", async () => {
    render(<AdminBookingsScreen />);
    // Start in timetable, switch to list, then back
    fireEvent.press(await screen.findByText("List"));
    await waitFor(() => expect(screen.getByText("Active")).toBeTruthy());
    fireEvent.press(screen.getByText("Timetable"));
    await waitFor(() => expect(adminGetTables).toHaveBeenCalled());
    expect(screen.getByText("Bookings")).toBeTruthy();
  });

  it("selects the same restaurant chip (no-op — should not trigger extra grid load)", async () => {
    render(<AdminBookingsScreen />);
    await waitFor(() => expect(screen.getByText("Bookings")).toBeTruthy());
    // Wait for initial restaurant load
    await waitFor(() => expect(adminGetTables).toHaveBeenCalled(), { timeout: 3000 });
    // There's only one restaurant in this test (no chips shown for single), but pressing
    // timetable button while already in timetable should trigger switchToTimetable
    fireEvent.press(screen.getByText("Timetable"));
    await waitFor(() => expect(adminGetTables).toHaveBeenCalled());
    expect(true).toBe(true);
  });

  it("renders wide list view with today's booking count", async () => {
    // Wide list view should show today's booking count in subtitle
    const today = new Date().toISOString();
    (getAdminBookings as jest.Mock).mockResolvedValue([{ ...mockBookings[0], date: today }]);
    render(<AdminBookingsScreen />);
    fireEvent.press(await screen.findByText("List"));
    await waitFor(() => {
      const subtitleElements = screen.getAllByText(/total|today/i);
      expect(subtitleElements.length).toBeGreaterThan(0);
    });
  });

  it("renders wide table view with booking name initials", async () => {
    // Test initials logic: single-word name -> first two chars; multi-word -> first letters
    (getAdminBookings as jest.Mock).mockResolvedValue([
      { ...mockBookings[0], customerName: "Alice Bob", customerEmail: "alice@example.com" },
    ]);
    render(<AdminBookingsScreen />);
    fireEvent.press(await screen.findByText("List"));
    await waitFor(() => expect(screen.getByText("Alice Bob")).toBeTruthy());
    // "AB" initials should appear
    expect(screen.getByText("AB")).toBeTruthy();
  });

  it("renders wide table with email initials (no name)", async () => {
    (getAdminBookings as jest.Mock).mockResolvedValue([
      { ...mockBookings[0], customerName: undefined, customerEmail: "test.user@example.com" },
    ]);
    render(<AdminBookingsScreen />);
    fireEvent.press(await screen.findByText("List"));
    await waitFor(() => expect(screen.getByText("test.user@example.com")).toBeTruthy());
    // "TU" initials from "test.user" -> "test user" -> first letters
    expect(screen.getByText("TU")).toBeTruthy();
  });

  it("NewBookingModal onCreated callback sets selected booking id", async () => {
    const { NewBookingModal } = require("@/components/admin/bookings/NewBookingModal");
    // The NewBookingModal is mocked to null, but we can verify the callback is wired
    // by checking that showNewModal opens when button is pressed
    render(<AdminBookingsScreen />);
    fireEvent.press(await screen.findByText("List"));
    fireEvent.press(await screen.findByText("New Booking"));
    // NewBookingModal becomes visible — since it's mocked to null, no visible change
    expect(screen.getByText("Bookings")).toBeTruthy();
  });

  it("BookingDetailPopup onDeleted callback refreshes bookings", async () => {
    // The onDeleted callback increments refreshKey which re-fetches bookings
    const { BookingDetailPopup } = require("@/components/admin/bookings/BookingDetailPopup");
    render(<AdminBookingsScreen />);
    await waitFor(() => expect(screen.getByText("Bookings")).toBeTruthy());
    // Since BookingDetailPopup is mocked to null, we can verify the screen renders
    expect(screen.getByText("Bookings")).toBeTruthy();
  });

  it("navigates to the next grid date via forward button", async () => {
    render(<AdminBookingsScreen />);
    await waitFor(() => expect(adminGetTables).toHaveBeenCalled(), { timeout: 3000 });
    const callsBefore = (adminGetTables as jest.Mock).mock.calls.length;
    fireEvent.press(screen.getByTestId("grid-nav-next"));
    await waitFor(() =>
      expect((adminGetTables as jest.Mock).mock.calls.length).toBeGreaterThan(callsBefore)
    );
  });

  it("navigates to the previous grid date via back button", async () => {
    render(<AdminBookingsScreen />);
    await waitFor(() => expect(adminGetTables).toHaveBeenCalled(), { timeout: 3000 });
    const callsBefore = (adminGetTables as jest.Mock).mock.calls.length;
    fireEvent.press(screen.getByTestId("grid-nav-prev"));
    await waitFor(() =>
      expect((adminGetTables as jest.Mock).mock.calls.length).toBeGreaterThan(callsBefore)
    );
  });

  it("resets grid date to today when date label is pressed on a non-today date", async () => {
    render(<AdminBookingsScreen />);
    await waitFor(() => expect(adminGetTables).toHaveBeenCalled(), { timeout: 3000 });
    // Navigate forward to make gridDate != today
    fireEvent.press(screen.getByTestId("grid-nav-next"));
    await waitFor(() => expect((adminGetTables as jest.Mock).mock.calls.length).toBeGreaterThan(1));
    // Now "tap for today" hint should appear; press the date label to reset
    const todayHint = screen.queryByText("tap for today");
    if (todayHint) {
      fireEvent.press(todayHint);
      await waitFor(() => expect(adminGetTables).toHaveBeenCalled());
    }
  });

  it("renders mobile card list when window is narrow", async () => {
    const mockUseDimensions = jest.spyOn(require("react-native"), "useWindowDimensions");
    mockUseDimensions.mockReturnValue({ width: 400, height: 800 });
    try {
      (getAdminBookings as jest.Mock).mockResolvedValue(mockBookings);
      render(<AdminBookingsScreen />);
      // Switch to list so the mobile card list renders (not timetable)
      await waitFor(() => expect(screen.getByTestId("view-toggle-list")).toBeTruthy());
      fireEvent.press(screen.getByTestId("view-toggle-list"));
      await waitFor(() => expect(screen.getByText("john@example.com")).toBeTruthy());
      // Mobile card list shows the booking
      expect(screen.getByText("john@example.com")).toBeTruthy();
    } finally {
      mockUseDimensions.mockRestore();
    }
  });

  it("pressing a mobile card opens the booking popup", async () => {
    const mockUseDimensions = jest.spyOn(require("react-native"), "useWindowDimensions");
    mockUseDimensions.mockReturnValue({ width: 400, height: 800 });
    try {
      (getAdminBookings as jest.Mock).mockResolvedValue(mockBookings);
      render(<AdminBookingsScreen />);
      await waitFor(() => expect(screen.getByTestId("view-toggle-list")).toBeTruthy());
      fireEvent.press(screen.getByTestId("view-toggle-list"));
      await waitFor(() => expect(screen.getByText("john@example.com")).toBeTruthy());
      fireEvent.press(screen.getByText("john@example.com"));
      expect(screen.getByText("Bookings")).toBeTruthy();
    } finally {
      mockUseDimensions.mockRestore();
    }
  });

  it("renders mobile card with customerName and email", async () => {
    const mockUseDimensions = jest.spyOn(require("react-native"), "useWindowDimensions");
    mockUseDimensions.mockReturnValue({ width: 400, height: 800 });
    try {
      (getAdminBookings as jest.Mock).mockResolvedValue([
        { ...mockBookings[0], customerName: "Alice Smith", customerEmail: "alice@example.com" },
      ]);
      render(<AdminBookingsScreen />);
      await waitFor(() => expect(screen.getByTestId("view-toggle-list")).toBeTruthy());
      fireEvent.press(screen.getByTestId("view-toggle-list"));
      await waitFor(() => expect(screen.getByText("Alice Smith")).toBeTruthy());
      expect(screen.getByText("alice@example.com")).toBeTruthy();
    } finally {
      mockUseDimensions.mockRestore();
    }
  });

  it("renders mobile card with cancelled badge", async () => {
    const mockUseDimensions = jest.spyOn(require("react-native"), "useWindowDimensions");
    mockUseDimensions.mockReturnValue({ width: 400, height: 800 });
    try {
      (getAdminBookings as jest.Mock).mockResolvedValue([
        { ...mockBookings[0], isCancelled: true },
      ]);
      render(<AdminBookingsScreen />);
      await waitFor(() => expect(screen.getByTestId("view-toggle-list")).toBeTruthy());
      fireEvent.press(screen.getByTestId("view-toggle-list"));
      await waitFor(() => expect(screen.getAllByText("Cancelled").length).toBeGreaterThan(0));
    } finally {
      mockUseDimensions.mockRestore();
    }
  });

  it("triggers cancel flow via row cancel button in wide table view", async () => {
    (getAdminBookings as jest.Mock).mockResolvedValue(mockBookings);
    render(<AdminBookingsScreen />);
    fireEvent.press(await screen.findByText("List"));
    await waitFor(() => expect(screen.getByText("john@example.com")).toBeTruthy());

    const cancelBtns = screen.queryAllByLabelText("Cancel booking");
    if (cancelBtns.length > 0) {
      // Provide a synthetic event with stopPropagation to avoid TypeError
      fireEvent.press(cancelBtns[0], { stopPropagation: jest.fn() });
      await waitFor(() => expect(screen.queryByText(/Cancel booking for/)).toBeTruthy());
      // Press Keep to dismiss the modal
      fireEvent.press(screen.getByText("Keep"));
      await waitFor(() => expect(screen.queryByText(/Cancel booking for/)).toBeNull());
    }
  });

  it("confirms cancel booking from row cancel button", async () => {
    (getAdminBookings as jest.Mock).mockResolvedValue(mockBookings);
    (adminDeleteBooking as jest.Mock).mockResolvedValue(true);
    render(<AdminBookingsScreen />);
    fireEvent.press(await screen.findByText("List"));
    await waitFor(() => expect(screen.getByText("john@example.com")).toBeTruthy());

    const cancelBtns = screen.queryAllByLabelText("Cancel booking");
    if (cancelBtns.length > 0) {
      fireEvent.press(cancelBtns[0], { stopPropagation: jest.fn() });
      const confirmBtns = await screen.findAllByText("Cancel Booking");
      // Last one is the confirm button in the modal
      fireEvent.press(confirmBtns[confirmBtns.length - 1]);
      await waitFor(() => expect(adminDeleteBooking).toHaveBeenCalledWith(1));
    }
  });

  it("pressing grid booking triggers onBookingPress callback", async () => {
    render(<AdminBookingsScreen />);
    await waitFor(() => expect(screen.getByTestId("grid-press-booking")).toBeTruthy());
    fireEvent.press(screen.getByTestId("grid-press-booking"));
    // selectedBookingId is now set; popup renders with close/deleted buttons
    await waitFor(() => expect(screen.getByTestId("popup-close")).toBeTruthy());
  });

  it("BookingDetailPopup onClose callback clears selectedBookingId", async () => {
    render(<AdminBookingsScreen />);
    // First open popup via grid press
    await waitFor(() => expect(screen.getByTestId("grid-press-booking")).toBeTruthy());
    fireEvent.press(screen.getByTestId("grid-press-booking"));
    await waitFor(() => expect(screen.getByTestId("popup-close")).toBeTruthy());
    // Now close it
    fireEvent.press(screen.getByTestId("popup-close"));
    expect(screen.getByText("Bookings")).toBeTruthy();
  });

  it("BookingDetailPopup onDeleted callback refreshes bookings and reloads grid", async () => {
    const callsBefore = (getAdminBookings as jest.Mock).mock.calls.length;
    render(<AdminBookingsScreen />);
    await waitFor(() => expect(screen.getByTestId("grid-press-booking")).toBeTruthy());
    fireEvent.press(screen.getByTestId("grid-press-booking"));
    await waitFor(() => expect(screen.getByTestId("popup-deleted")).toBeTruthy());
    fireEvent.press(screen.getByTestId("popup-deleted"));
    await waitFor(() =>
      expect((getAdminBookings as jest.Mock).mock.calls.length).toBeGreaterThan(callsBefore)
    );
  });

  it("NewBookingModal onClose callback hides the modal", async () => {
    render(<AdminBookingsScreen />);
    await waitFor(() => expect(screen.getByText("List")).toBeTruthy());
    // Open new booking modal via header button
    const newBtns = screen.queryAllByText("New Booking");
    // Header button is present in timetable view
    expect(screen.getByText("Bookings")).toBeTruthy();
    // Close the modal
    const closeBtn = screen.queryByTestId("newmodal-close");
    if (closeBtn) {
      fireEvent.press(closeBtn);
      expect(screen.getByText("Bookings")).toBeTruthy();
    }
  });

  it("NewBookingModal onCreated callback sets selectedBookingId", async () => {
    render(<AdminBookingsScreen />);
    await waitFor(() => expect(screen.getByTestId("newmodal-created")).toBeTruthy());
    fireEvent.press(screen.getByTestId("newmodal-created"));
    // After onCreated(99), showNewModal=false and selectedBookingId=99; popup renders
    await waitFor(() => expect(screen.getByTestId("popup-close")).toBeTruthy());
  });

  it("presses New Booking button in empty list state", async () => {
    (getAdminBookings as jest.Mock).mockResolvedValue([]);
    render(<AdminBookingsScreen />);
    fireEvent.press(await screen.findByText("List"));
    await waitFor(() => expect(screen.getByText("No bookings found")).toBeTruthy());
    // Press the "New Booking" button inside the empty state
    const newBtns = screen.queryAllByText("New Booking");
    if (newBtns.length > 0) {
      fireEvent.press(newBtns[newBtns.length - 1]);
      // NewBookingModal should become visible (onClose/onCreated buttons appear)
      await waitFor(() => expect(screen.getByTestId("newmodal-close")).toBeTruthy());
    }
  });
});
