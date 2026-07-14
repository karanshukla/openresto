import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { BookingsCardList } from "@/components/admin/bookings/BookingsCardList";
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

const booking: BookingDetailDto = {
  id: 2,
  customerName: "Bob Smith",
  customerEmail: "bob@example.com",
  date: new Date(Date.now() + 86_400_000).toISOString(),
  seats: 2,
  tableName: "T2",
  isCancelled: false,
  bookingRef: "XYZ789",
} as BookingDetailDto;

describe("BookingsCardList", () => {
  const sort = { key: "date" as const, dir: "asc" as const };

  it("renders the customer name, email, party + table info", () => {
    render(
      <BookingsCardList
        bookings={[booking]}
        focusedRowId={null}
        onOpenBooking={() => {}}
        sort={sort}
        onSortChange={() => {}}
        {...theme}
      />
    );
    expect(screen.getByText("Bob Smith")).toBeTruthy();
    expect(screen.getByText("bob@example.com")).toBeTruthy();
    expect(screen.getByText("2 guests · T2")).toBeTruthy();
    expect(screen.getByText("BS")).toBeTruthy(); // initials
  });

  it("renders the cancelled badge for a cancelled booking", () => {
    render(
      <BookingsCardList
        bookings={[{ ...booking, isCancelled: true }]}
        focusedRowId={null}
        onOpenBooking={() => {}}
        sort={sort}
        onSortChange={() => {}}
        {...theme}
      />
    );
    expect(screen.getByText("Cancelled")).toBeTruthy();
  });

  it("fires onOpenBooking with the id when the card is pressed", () => {
    const onOpen = jest.fn();
    render(
      <BookingsCardList
        bookings={[booking]}
        focusedRowId={null}
        onOpenBooking={onOpen}
        sort={sort}
        onSortChange={() => {}}
        {...theme}
      />
    );
    fireEvent.press(screen.getByTestId("booking-row-2"));
    expect(onOpen).toHaveBeenCalledWith(2);
  });

  it("renders the sort control above the cards", () => {
    render(
      <BookingsCardList
        bookings={[booking]}
        focusedRowId={null}
        onOpenBooking={() => {}}
        sort={sort}
        onSortChange={() => {}}
        {...theme}
      />
    );
    expect(screen.getByLabelText(/Sort by Guest/)).toBeTruthy();
  });
});
