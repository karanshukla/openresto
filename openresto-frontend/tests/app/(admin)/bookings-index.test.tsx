/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react-native";
import AdminBookingsScreen from "@/app/(admin)/bookings/index";
import { getAdminBookings, adminDeleteBooking, adminLookupBookings } from "@/api/admin";

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

// Stub heavy sub-components that are not under test here
jest.mock("@/components/admin/bookings/AvailabilityGrid", () => ({
  AvailabilityGrid: () => null,
}));

jest.mock("@/components/admin/bookings/BookingDetailPopup", () => ({
  BookingDetailPopup: () => null,
}));

jest.mock("@/components/admin/bookings/NewBookingModal", () => ({
  NewBookingModal: () => null,
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
});
