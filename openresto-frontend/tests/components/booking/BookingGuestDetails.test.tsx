import React from "react";
import { render, screen } from "@testing-library/react-native";
import BookingGuestDetails from "@/components/booking/BookingGuestDetails";
import { BookingDto } from "@/api/bookings";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

const booking = {
  id: 1,
  restaurantId: 1,
  customerEmail: "test@test.com",
  customerName: "Ada",
  date: "2026-10-10T19:00:00Z",
  seats: 2,
  isHeld: false,
} as BookingDto;

const renderDetails = (overrides: Partial<BookingDto> = {}) =>
  render(<BookingGuestDetails booking={{ ...booking, ...overrides }} mutedColor="gray" />);

describe("BookingGuestDetails", () => {
  it("names who the booking is under, with the email beneath", () => {
    renderDetails();
    expect(screen.getByText("Booked under Ada")).toBeTruthy();
    expect(screen.getByText("test@test.com")).toBeTruthy();
  });

  it("falls back to the email alone when no name was given", () => {
    renderDetails({ customerName: undefined });
    expect(screen.getByText("Booked with")).toBeTruthy();
    expect(screen.getByText("test@test.com")).toBeTruthy();
  });

  it("keeps special requests visible rather than behind a disclosure", () => {
    renderDetails({ specialRequests: "Nut allergy" });
    expect(screen.getByText("Special requests")).toBeTruthy();
    expect(screen.getByText("Nut allergy")).toBeTruthy();
  });

  it("omits the requests line entirely instead of printing 'None'", () => {
    renderDetails({ specialRequests: undefined });
    expect(screen.queryByText("Special requests")).toBeNull();
    expect(screen.queryByText("None")).toBeNull();
  });

  it("treats a whitespace-only request as no request", () => {
    renderDetails({ specialRequests: "   " });
    expect(screen.queryByText("Special requests")).toBeNull();
  });
});
