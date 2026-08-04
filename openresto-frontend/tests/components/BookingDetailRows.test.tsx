import React from "react";
import { render, screen } from "@testing-library/react-native";
import BookingDetailRows from "@/components/booking/BookingDetailRows";
import { BookingDto } from "@/api/bookings";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

describe("BookingDetailRows", () => {
  const mockBooking: BookingDto = {
    id: 1,
    tableId: 101,
    sectionId: 10,
    restaurantId: 1,
    isHeld: false,
    customerEmail: "test@test.com",
    date: "2026-10-10T19:00:00Z",
    seats: 2,
    bookingRef: "REF",
    tableName: "Table 5",
    sectionName: "Garden",
    tableSeats: 4,
    specialRequests: "Birthday",
  };

  const mockRestaurant = {
    name: "Resto 1",
    address: "123 Main St",
  };

  it("renders all rows when data is complete", () => {
    render(
      <BookingDetailRows
        booking={mockBooking}
        restaurant={mockRestaurant as any}
        mutedColor="gray"
        borderColor="black"
      />
    );

    expect(screen.getByText("Restaurant")).toBeTruthy();
    expect(screen.getByText("Resto 1")).toBeTruthy();
    expect(screen.getByText("Address")).toBeTruthy();
    expect(screen.getByText("123 Main St")).toBeTruthy();
    expect(screen.getByText("Email")).toBeTruthy();
    expect(screen.getByText("test@test.com")).toBeTruthy();
    expect(screen.getByText("Birthday")).toBeTruthy();
    expect(screen.getByText(/Table for 4/)).toBeTruthy();
  });

  it("handles missing restaurant and optional fields", () => {
    const incompleteBooking: BookingDto = {
      ...mockBooking,
      tableName: undefined,
      specialRequests: undefined,
    };
    render(
      <BookingDetailRows
        booking={incompleteBooking}
        restaurant={null}
        mutedColor="gray"
        borderColor="black"
      />
    );

    expect(screen.queryByText("Restaurant")).toBeNull();
    expect(screen.queryByText("Address")).toBeNull();
    expect(screen.getByText("Requests")).toBeTruthy();
    expect(screen.getByText("None")).toBeTruthy();
    expect(screen.queryByText("Table")).toBeNull();
  });

  it("renders table name without section if section missing", () => {
    const noSectionBooking: BookingDto = {
      ...mockBooking,
      sectionName: undefined,
    };
    render(
      <BookingDetailRows
        booking={noSectionBooking}
        restaurant={null}
        mutedColor="gray"
        borderColor="black"
      />
    );
    expect(screen.getByText("Table 5")).toBeTruthy();
  });

  it("renders a 'Tables' row with the group label for a group booking", () => {
    // A group booking (combinable tables) has tableGroupId set and tableId null. The backend
    // populates tableName with the group label and tableSeats with the combined capacity. The row
    // must surface as "Tables" (not "Table") so the diner sees they reserved a merged group.
    const groupBooking: BookingDto = {
      ...mockBooking,
      tableId: null,
      tableGroupId: 7,
      seats: 6,
      tableSeats: 8,
      tableName: "Tables T2 + T3",
    };
    render(
      <BookingDetailRows
        booking={groupBooking}
        restaurant={null}
        mutedColor="gray"
        borderColor="black"
      />
    );

    expect(screen.getByText("Tables")).toBeTruthy();
    expect(screen.getByText("Tables T2 + T3")).toBeTruthy();
    // A group booking must not also render the single-table "Table" row.
    expect(screen.queryByText("Table")).toBeNull();
    // The combined capacity is shown in the Guests row.
    expect(screen.getByText(/Table for 8/)).toBeTruthy();
  });
});
