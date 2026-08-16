import React from "react";
import { render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import BookingSummaryHeader, { buildSeatingLine } from "@/components/booking/BookingSummaryHeader";
import { BookingDto } from "@/api/bookings";
import { RestaurantDto } from "@/api/restaurants";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

const booking = {
  id: 1,
  restaurantId: 1,
  customerEmail: "test@test.com",
  date: "2026-10-10T19:00:00Z",
  seats: 2,
  isHeld: false,
  sectionName: "Garden",
  tableName: "Table 5",
} as BookingDto;

const restaurant = { id: 1, name: "Resto 1", address: "123 Main St" } as RestaurantDto;

const renderHeader = (props: Partial<React.ComponentProps<typeof BookingSummaryHeader>> = {}) =>
  render(
    <BookingSummaryHeader
      booking={booking}
      restaurant={restaurant}
      statusLabel="Booking Found"
      statusIcon="checkmark-circle"
      statusColor="green"
      mutedColor="gray"
      {...props}
    />
  );

describe("BookingSummaryHeader", () => {
  it("heads the card with the restaurant, and collapses address, section and table into one line", () => {
    renderHeader();
    expect(screen.getByText("Booking Found")).toBeTruthy();
    expect(screen.getByText("Resto 1")).toBeTruthy();
    expect(screen.getByText("123 Main St · Garden · Table 5")).toBeTruthy();
  });

  it("promotes the status to the heading when the restaurant didn't resolve", () => {
    renderHeader({ restaurant: null });
    // One "Booking Found", not two — the eyebrow gives way rather than repeating itself.
    expect(screen.getAllByText("Booking Found")).toHaveLength(1);
    expect(screen.queryByText(/123 Main St/)).toBeNull();
  });

  it("omits the seating line entirely when there is nothing to put in it", () => {
    renderHeader({
      booking: { ...booking, sectionName: undefined, tableName: undefined },
      restaurant: { ...restaurant, address: "" } as RestaurantDto,
    });
    expect(screen.getByText("Resto 1")).toBeTruthy();
    expect(screen.queryByText(/·/)).toBeNull();
  });

  it("washes the header with the tint it is given, and stays untinted without one", () => {
    renderHeader({ tint: "#ff000012" });
    expect(
      StyleSheet.flatten(screen.getByTestId("booking-summary-header").props.style).backgroundColor
    ).toBe("#ff000012");

    screen.unmount();
    renderHeader();
    expect(
      StyleSheet.flatten(screen.getByTestId("booking-summary-header").props.style).backgroundColor
    ).toBeUndefined();
  });

  describe("buildSeatingLine", () => {
    it("uses the group label for a combined-table booking", () => {
      expect(
        buildSeatingLine({ ...booking, tableGroupId: 7, tableName: "Tables T2 + T3" }, restaurant)
      ).toBe("123 Main St · Garden · Tables T2 + T3");
    });

    it("falls back to a generic label when a group booking carries no name", () => {
      expect(
        buildSeatingLine({ ...booking, tableGroupId: 7, tableName: undefined }, restaurant)
      ).toBe("123 Main St · Garden · Combined tables");
    });

    it("drops the separators for the parts that are missing", () => {
      expect(
        buildSeatingLine({ ...booking, sectionName: undefined, tableName: undefined }, restaurant)
      ).toBe("123 Main St");
      expect(buildSeatingLine(booking, null)).toBe("Garden · Table 5");
    });
  });
});
