/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, fireEvent } from "@testing-library/react-native";
import RecentBookingsList, { COLLAPSED_COUNT } from "@/components/booking/RecentBookingsList";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";
import { getThemeColors } from "@/theme/theme";

const colors = getThemeColors(false);

const makeCached = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    bookingRef: `REF${i + 1}`,
    email: "a@b.com",
    restaurantName: "Harbourside",
    date: "2026-08-23",
    seats: 2,
    createdAt: "2026-08-01T00:00:00Z",
  }));

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

  it("tells the diner the list is device-local", () => {
    renderWithProviders(
      <RecentBookingsList cached={makeCached(1)} colors={colors} onSelect={jest.fn()} />
    );
    expect(screen.getByText(/stored on this device/)).toBeTruthy();
  });

  describe("overflow", () => {
    it("shows every booking, and no toggle, at the collapsed limit", () => {
      renderWithProviders(
        <RecentBookingsList
          cached={makeCached(COLLAPSED_COUNT)}
          colors={colors}
          onSelect={jest.fn()}
        />
      );
      expect(screen.getByText(`REF${COLLAPSED_COUNT}`)).toBeTruthy();
      expect(screen.queryByText(/Show all/)).toBeNull();
    });

    it("truncates past the limit and expands on request", () => {
      const cached = makeCached(COLLAPSED_COUNT + 3);
      renderWithProviders(
        <RecentBookingsList cached={cached} colors={colors} onSelect={jest.fn()} />
      );

      expect(screen.getByText(`REF${COLLAPSED_COUNT}`)).toBeTruthy();
      expect(screen.queryByText(`REF${COLLAPSED_COUNT + 1}`)).toBeNull();

      fireEvent.press(screen.getByText(`Show all ${cached.length}`));
      expect(screen.getByText(`REF${COLLAPSED_COUNT + 1}`)).toBeTruthy();
      expect(screen.getByText(`REF${cached.length}`)).toBeTruthy();

      fireEvent.press(screen.getByText("Show fewer"));
      expect(screen.queryByText(`REF${COLLAPSED_COUNT + 1}`)).toBeNull();
    });

    it("keeps the expanded row selectable", () => {
      const onSelect = jest.fn();
      const cached = makeCached(COLLAPSED_COUNT + 1);
      renderWithProviders(
        <RecentBookingsList cached={cached} colors={colors} onSelect={onSelect} />
      );

      fireEvent.press(screen.getByText(`Show all ${cached.length}`));
      fireEvent.press(screen.getByText(`REF${cached.length}`));
      expect(onSelect).toHaveBeenCalledWith(cached[cached.length - 1]);
    });
  });
});
