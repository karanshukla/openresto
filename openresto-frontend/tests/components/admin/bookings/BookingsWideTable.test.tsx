import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { BookingsWideTable } from "@/components/admin/bookings/BookingsWideTable";
import { BookingDetailDto } from "@/api/admin";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/components/admin/bookings/StatusBadge", () => ({
  StatusBadge: () => null,
  isPast: (date: string) => new Date(date).getTime() < Date.now(),
}));

const theme = {
  borderColor: "#ddd",
  cardBg: "#fff",
  mutedColor: "#888",
  isDark: false,
  primaryColor: "#0a7ea4",
};

const activeBooking: BookingDetailDto = {
  id: 1,
  customerName: "Alice Wong",
  customerEmail: "alice@example.com",
  date: new Date(Date.now() + 86_400_000).toISOString(), // tomorrow — not past
  seats: 4,
  tableName: "T1",
  isCancelled: false,
  bookingRef: "ABC123",
} as BookingDetailDto;

describe("BookingsWideTable", () => {
  it("renders one row per booking with the customer name + initials", () => {
    render(
      <BookingsWideTable
        bookings={[activeBooking]}
        focusedRowId={null}
        onOpenBooking={() => {}}
        onCancelBooking={() => {}}
        {...theme}
      />
    );
    expect(screen.getByText("Alice Wong")).toBeTruthy();
    expect(screen.getByText("alice@example.com")).toBeTruthy();
    expect(screen.getByText("ABC123")).toBeTruthy();
    expect(screen.getByText("AW")).toBeTruthy(); // initials
  });

  it("renders the cancel button for an active, non-past booking", () => {
    render(
      <BookingsWideTable
        bookings={[activeBooking]}
        focusedRowId={null}
        onOpenBooking={() => {}}
        onCancelBooking={() => {}}
        {...theme}
      />
    );
    expect(screen.getByLabelText("Cancel booking")).toBeTruthy();
  });

  it("omits the cancel button for a cancelled booking", () => {
    const cancelled = { ...activeBooking, isCancelled: true };
    render(
      <BookingsWideTable
        bookings={[cancelled]}
        focusedRowId={null}
        onOpenBooking={() => {}}
        onCancelBooking={() => {}}
        {...theme}
      />
    );
    expect(screen.queryByLabelText("Cancel booking")).toBeNull();
    expect(screen.getByText("Cancelled")).toBeTruthy();
  });

  it("fires onOpenBooking with the id when the row is pressed", () => {
    const onOpen = jest.fn();
    render(
      <BookingsWideTable
        bookings={[activeBooking]}
        focusedRowId={null}
        onOpenBooking={onOpen}
        onCancelBooking={() => {}}
        {...theme}
      />
    );
    fireEvent.press(screen.getByTestId("booking-row-1"));
    expect(onOpen).toHaveBeenCalledWith(1);
  });

  it("fires onCancelBooking with the booking when the cancel button is pressed", () => {
    const onCancel = jest.fn();
    render(
      <BookingsWideTable
        bookings={[activeBooking]}
        focusedRowId={null}
        onOpenBooking={() => {}}
        onCancelBooking={onCancel}
        {...theme}
      />
    );
    fireEvent.press(screen.getByLabelText("Cancel booking"));
    expect(onCancel).toHaveBeenCalledWith(activeBooking);
  });
});
