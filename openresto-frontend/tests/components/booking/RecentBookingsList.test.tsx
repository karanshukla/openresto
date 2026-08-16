/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, fireEvent } from "@testing-library/react-native";
import RecentBookingsList from "@/components/booking/RecentBookingsList";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";
import { getThemeColors } from "@/theme/theme";

const colors = getThemeColors(false);

describe("RecentBookingsList", () => {
  it("renders nothing when there are no cached bookings", () => {
    renderWithProviders(<RecentBookingsList cached={[]} colors={colors} onSelect={jest.fn()} />);
    expect(screen.queryByText("YOUR RECENT BOOKINGS")).toBeNull();
  });

  it("lists each cached booking with its restaurant, date and guest count", () => {
    renderWithProviders(
      <RecentBookingsList
        cached={[
          {
            bookingRef: "REF1",
            email: "a@b.com",
            restaurantName: "Harbourside",
            date: "2026-08-23",
            seats: 4,
            createdAt: "2026-08-01T00:00:00Z",
          },
        ]}
        colors={colors}
        onSelect={jest.fn()}
      />
    );
    expect(screen.getByText("YOUR RECENT BOOKINGS")).toBeTruthy();
    expect(screen.getByText("REF1")).toBeTruthy();
    expect(screen.getByText(/Harbourside/)).toBeTruthy();
    expect(screen.getByText(/4 guests$/)).toBeTruthy();
  });

  it("uses singular guest copy and omits the restaurant name when absent", () => {
    renderWithProviders(
      <RecentBookingsList
        cached={[
          {
            bookingRef: "SOLO",
            email: "solo@test.com",
            restaurantName: "",
            date: "2026-05-01",
            seats: 1,
            createdAt: "2026-04-01T00:00:00Z",
          },
        ]}
        colors={colors}
        onSelect={jest.fn()}
      />
    );
    expect(screen.getByText(/1 guest$/)).toBeTruthy();
    expect(screen.getByLabelText("Look up booking SOLO")).toBeTruthy();
  });

  it("calls onSelect with the pressed booking", () => {
    const onSelect = jest.fn();
    const cached = [
      {
        bookingRef: "REF1",
        email: "a@b.com",
        restaurantName: "Harbourside",
        date: "2026-08-23",
        seats: 4,
        createdAt: "2026-08-01T00:00:00Z",
      },
    ];
    renderWithProviders(<RecentBookingsList cached={cached} colors={colors} onSelect={onSelect} />);
    fireEvent.press(screen.getByText("REF1"));
    expect(onSelect).toHaveBeenCalledWith(cached[0]);
  });
});
