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

const sort = { key: "date" as const, dir: "asc" as const };

describe("BookingsWideTable", () => {
  it("renders one row per booking with the customer name + initials", () => {
    render(
      <BookingsWideTable
        bookings={[activeBooking]}
        focusedRowId={null}
        onOpenBooking={() => {}}
        onCancelBooking={() => {}}
        sort={sort}
        onSortChange={() => {}}
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
        sort={sort}
        onSortChange={() => {}}
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
        sort={sort}
        onSortChange={() => {}}
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
        sort={sort}
        onSortChange={() => {}}
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
        sort={sort}
        onSortChange={() => {}}
        {...theme}
      />
    );
    fireEvent.press(screen.getByLabelText("Cancel booking"));
    expect(onCancel).toHaveBeenCalledWith(activeBooking);
  });

  it("renders sortable TIME/GUEST/PARTY/TABLE headers (STATUS is not sortable)", () => {
    render(
      <BookingsWideTable
        bookings={[activeBooking]}
        focusedRowId={null}
        onOpenBooking={() => {}}
        onCancelBooking={() => {}}
        sort={sort}
        onSortChange={() => {}}
        {...theme}
      />
    );
    expect(screen.getByLabelText(/Sort by TIME/)).toBeTruthy();
    expect(screen.getByLabelText(/Sort by GUEST/)).toBeTruthy();
    expect(screen.getByLabelText(/Sort by PARTY/)).toBeTruthy();
    expect(screen.getByLabelText(/Sort by TABLE/)).toBeTruthy();
    expect(screen.getByLabelText(/Sort by STATUS/)).toBeTruthy();
  });

  it("marks the active column header with its sort direction in the label", () => {
    render(
      <BookingsWideTable
        bookings={[activeBooking]}
        focusedRowId={null}
        onOpenBooking={() => {}}
        onCancelBooking={() => {}}
        sort={{ key: "guest", dir: "desc" }}
        onSortChange={() => {}}
        {...theme}
      />
    );
    expect(screen.getByLabelText("Sort by GUEST, descending")).toBeTruthy();
    // An inactive header is labeled "not sorted".
    expect(screen.getByLabelText("Sort by TIME, not sorted")).toBeTruthy();
  });

  it("calls onSortChange with the column key when a header is pressed", () => {
    const onSort = jest.fn();
    render(
      <BookingsWideTable
        bookings={[activeBooking]}
        focusedRowId={null}
        onOpenBooking={() => {}}
        onCancelBooking={() => {}}
        sort={sort}
        onSortChange={onSort}
        {...theme}
      />
    );
    fireEvent.press(screen.getByTestId("sort-header-table"));
    expect(onSort).toHaveBeenCalledWith("table");
  });
});
