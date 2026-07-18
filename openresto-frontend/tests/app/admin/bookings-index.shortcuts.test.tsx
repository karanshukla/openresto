/**
 * @jest-environment jsdom
 */
import React from "react";
import { Platform } from "react-native";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import { act } from "react-test-renderer";
import AdminBookingsScreen from "@/app/admin/bookings/index";
import { getAdminBookings, adminLookupBookings } from "@/api/admin";

jest.mock("@/api/admin", () => ({
  getAdminBookings: jest.fn(),
  adminGetTables: jest.fn().mockResolvedValue([]),
  adminDeleteBooking: jest.fn().mockResolvedValue(true),
  adminLookupBookings: jest.fn().mockResolvedValue([]),
  getAdminBooking: jest.fn().mockResolvedValue(null),
}));

const mockSearchParams: Record<string, string | undefined> = {};

jest.mock("expo-router", () => {
  const Stack = { Screen: () => null };
  return {
    Stack,
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
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

jest.mock("@/components/admin/bookings/AvailabilityGrid", () => ({
  AvailabilityGrid: () => null,
}));

jest.mock("@/components/admin/bookings/BookingDetailPopup", () => ({
  BookingDetailPopup: ({
    bookingId,
    initialFocus,
  }: {
    bookingId: number | null;
    initialFocus?: "extend";
  }) => {
    const { Text } = require("react-native");
    return (
      <>
        <Text testID="popup-booking-id">{bookingId ?? "none"}</Text>
        <Text testID="popup-initial-focus">{initialFocus ?? "none"}</Text>
      </>
    );
  },
}));

jest.mock("@/components/admin/bookings/NewBookingModal", () => ({
  NewBookingModal: () => null,
}));

global.fetch = jest.fn(() =>
  Promise.resolve({ ok: true, json: () => Promise.resolve([{ id: 1, name: "Resto 1" }]) })
) as jest.Mock;

function dispatchKeydown(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

describe("AdminBookingsScreen keyboard row selection", () => {
  const now = Date.now();
  const mockBookings = [
    {
      id: 1,
      bookingRef: "REF1",
      customerEmail: "first@example.com",
      status: "active",
      date: new Date(now + 60 * 60 * 1000).toISOString(),
      seats: 2,
      restaurantId: 1,
      restaurantName: "Resto 1",
      sectionId: 1,
      sectionName: "Main",
      tableId: 1,
      tableName: "T1",
    },
    {
      id: 2,
      bookingRef: "REF2",
      customerEmail: "second@example.com",
      status: "active",
      date: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
      seats: 4,
      restaurantId: 1,
      restaurantName: "Resto 1",
      sectionId: 1,
      sectionName: "Main",
      tableId: 2,
      tableName: "T2",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = "web";
    (getAdminBookings as jest.Mock).mockResolvedValue(mockBookings);
    (adminLookupBookings as jest.Mock).mockResolvedValue([]);
    Object.keys(mockSearchParams).forEach((k) => delete mockSearchParams[k]);
  });

  async function switchToList() {
    render(<AdminBookingsScreen />);
    const listBtn = await screen.findByText("List");
    fireEvent.press(listBtn);
    await waitFor(() => expect(screen.getByText("first@example.com")).toBeTruthy());
  }

  it("moves the row selection down with j and opens it with Enter", async () => {
    await switchToList();

    dispatchKeydown("j");
    dispatchKeydown("Enter");

    await waitFor(() => expect(screen.getByTestId("popup-booking-id").props.children).toBe(1));
    expect(screen.getByTestId("popup-initial-focus").props.children).toBe("none");
  });

  it("moves the row selection with j twice then back up with k", async () => {
    await switchToList();

    dispatchKeydown("j");
    dispatchKeydown("j");
    dispatchKeydown("k");
    dispatchKeydown("Enter");

    await waitFor(() => expect(screen.getByTestId("popup-booking-id").props.children).toBe(1));
  });

  it("opens the currently selected row on 'e' with the extend focus target set", async () => {
    await switchToList();

    dispatchKeydown("j");
    dispatchKeydown("j");
    dispatchKeydown("e");

    await waitFor(() => expect(screen.getByTestId("popup-booking-id").props.children).toBe(2));
    expect(screen.getByTestId("popup-initial-focus").props.children).toBe("extend");
  });

  it("does nothing on 'e' before any row has been focused with j/k", async () => {
    await switchToList();

    dispatchKeydown("e");

    expect(screen.getByTestId("popup-booking-id").props.children).toBe("none");
    expect(screen.getByTestId("popup-initial-focus").props.children).toBe("none");
  });

  it("moves the row selection with ArrowDown and ArrowUp", async () => {
    await switchToList();

    dispatchKeydown("ArrowDown");
    dispatchKeydown("ArrowDown");
    dispatchKeydown("ArrowUp");
    dispatchKeydown("Enter");

    await waitFor(() => expect(screen.getByTestId("popup-booking-id").props.children).toBe(1));
  });

  it("does nothing on Enter before any row has been focused with j/k", async () => {
    await switchToList();

    dispatchKeydown("Enter");

    expect(screen.getByTestId("popup-booking-id").props.children).toBe("none");
  });

  it("does not react to j/k/Enter while in timetable view", async () => {
    render(<AdminBookingsScreen />);
    await waitFor(() => expect(screen.getByText("Bookings")).toBeTruthy());

    dispatchKeydown("j");
    dispatchKeydown("Enter");

    expect(screen.getByTestId("popup-booking-id").props.children).toBe("none");
  });

  it("does not let j/k/e swap the popup's booking once one is already open (issue #140 review, Concern 1)", async () => {
    await switchToList();

    dispatchKeydown("j");
    dispatchKeydown("Enter");
    await waitFor(() => expect(screen.getByTestId("popup-booking-id").props.children).toBe(1));

    // The popup for booking 1 is now open. A stray row-nav keypress must not
    // reassign selectedBookingId out from under the open popup.
    dispatchKeydown("j");
    dispatchKeydown("e");

    expect(screen.getByTestId("popup-booking-id").props.children).toBe(1);
    expect(screen.getByTestId("popup-initial-focus").props.children).toBe("none");
  });
});
