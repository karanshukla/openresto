import React from "react";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import BookingFactsBand, { buildFacts } from "@/components/booking/BookingFactsBand";
import { BookingDto } from "@/api/bookings";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

const booking = {
  id: 1,
  restaurantId: 1,
  customerEmail: "test@test.com",
  date: "2026-10-10T19:00:00Z",
  endTime: "2026-10-10T21:00:00Z",
  seats: 2,
  tableSeats: 4,
  isHeld: false,
} as BookingDto;

// Date and time strings are locale-dependent (the CI container and a dev machine disagree),
// so the expectations are derived through the same formatter rather than hardcoded.
const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

const renderBand = (props: Partial<React.ComponentProps<typeof BookingFactsBand>> = {}) =>
  render(<BookingFactsBand booking={booking} mutedColor="gray" borderColor="black" {...props} />);

describe("BookingFactsBand", () => {
  it("gives date, time and party a cell each at full width", () => {
    renderBand();
    expect(screen.getByText("Date")).toBeTruthy();
    expect(screen.getByText("Time")).toBeTruthy();
    expect(screen.getByText("Guests")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText(timeOf(booking.date))).toBeTruthy();
  });

  it("carries the year, the sitting's end and the table size as subtext", () => {
    renderBand();
    expect(screen.getByText("2026")).toBeTruthy();
    expect(screen.getByText(`until ${timeOf(booking.endTime!)}`)).toBeTruthy();
    expect(screen.getByText("Table for 4")).toBeTruthy();
  });

  it("drops the end time and table size when the booking has neither", () => {
    renderBand({ booking: { ...booking, endTime: undefined, tableSeats: undefined } });
    expect(screen.queryByText(/^until /)).toBeNull();
    expect(screen.queryByText(/^Table for /)).toBeNull();
  });

  it("drops the end time when it isn't a parseable date", () => {
    renderBand({ booking: { ...booking, endTime: "not-a-date" } });
    expect(screen.queryByText(/^until /)).toBeNull();
  });

  it("pairs date with time in one cell when compact, leaving two cells", () => {
    renderBand({ compact: true });
    expect(screen.getByText("Date & time")).toBeTruthy();
    expect(screen.queryByText("Date")).toBeNull();
    expect(screen.queryByText("Time")).toBeNull();
    expect(screen.getByText(timeOf(booking.date))).toBeTruthy();
    expect(screen.getByText("Guests")).toBeTruthy();
  });

  it("strikes the facts through for a cancelled booking", () => {
    renderBand({ negated: true });
    const flattened = StyleSheet.flatten(screen.getByText("2").props.style);
    expect(flattened.textDecorationLine).toBe("line-through");
  });

  it("leaves them unstruck otherwise", () => {
    renderBand();
    const flattened = StyleSheet.flatten(screen.getByText("2").props.style);
    expect(flattened.textDecorationLine).toBeUndefined();
  });

  describe("buildFacts", () => {
    it("returns three facts wide and two compact", () => {
      expect(buildFacts(booking, false).map((f) => f.key)).toEqual(["Date", "Time", "Guests"]);
      expect(buildFacts(booking, true).map((f) => f.key)).toEqual(["Date & time", "Guests"]);
    });

    it("puts the time under the date in the compact pairing", () => {
      expect(buildFacts(booking, true)[0].sub).toBe(timeOf(booking.date));
    });
  });
});
