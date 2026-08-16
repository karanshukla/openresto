/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";
import BookingResultPanel from "@/components/booking/BookingResultPanel";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";
import { BookingDto } from "@/api/bookings";
import { RestaurantDto } from "@/api/restaurants";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });

const mockBooking = {
  id: 1,
  bookingRef: "REF123",
  customerEmail: "test@test.com",
  restaurantId: 1,
  date: "2026-10-10T12:00:00Z",
  seats: 2,
  isCancelled: false,
} as BookingDto;

const mockRestaurant = { id: 1, name: "Test Resto", address: "123 Main St" } as RestaurantDto;

describe("BookingResultPanel", () => {
  beforeEach(() => {
    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
  });

  it("shows 'Booking Found' for an ordinary, non-justBooked upcoming booking", () => {
    renderWithProviders(
      <BookingResultPanel
        booking={mockBooking}
        restaurant={mockRestaurant}
        compact={false}
        cancelling={false}
        onCancelPress={jest.fn()}
      />
    );
    expect(screen.getByText("Booking Found")).toBeTruthy();
    expect(screen.getByText("REF123")).toBeTruthy();
    expect(screen.getByText("Cancel This Booking")).toBeTruthy();
  });

  it("shows 'Booking Confirmed' instead when justBooked", () => {
    renderWithProviders(
      <BookingResultPanel
        booking={mockBooking}
        restaurant={mockRestaurant}
        compact={false}
        justBooked
        cancelling={false}
        onCancelPress={jest.fn()}
      />
    );
    expect(screen.getByText("Booking Confirmed")).toBeTruthy();
    expect(screen.queryByText("Booking Found")).toBeNull();
  });

  it("shows 'Booking Cancelled' and drops the cancel button for a cancelled booking, even justBooked", () => {
    renderWithProviders(
      <BookingResultPanel
        booking={{ ...mockBooking, isCancelled: true }}
        restaurant={mockRestaurant}
        compact={false}
        justBooked
        cancelling={false}
        onCancelPress={jest.fn()}
      />
    );
    expect(screen.getByText("Booking Cancelled")).toBeTruthy();
    expect(screen.queryByText("Cancel This Booking")).toBeNull();
    expect(screen.getByText("This booking has been cancelled.")).toBeTruthy();
  });

  it("shows 'Booking Has Passed' and drops the cancel button for a past booking", () => {
    renderWithProviders(
      <BookingResultPanel
        booking={{ ...mockBooking, date: "2020-01-01T12:00:00Z" }}
        restaurant={mockRestaurant}
        compact={false}
        cancelling={false}
        onCancelPress={jest.fn()}
      />
    );
    expect(screen.getByText("Booking Has Passed")).toBeTruthy();
    expect(screen.queryByText("Cancel This Booking")).toBeNull();
    expect(
      screen.getByText("This booking has already passed and can no longer be cancelled.")
    ).toBeTruthy();
  });

  it("a past date wins over justBooked too", () => {
    renderWithProviders(
      <BookingResultPanel
        booking={{ ...mockBooking, date: "2020-01-01T12:00:00Z" }}
        restaurant={mockRestaurant}
        compact={false}
        justBooked
        cancelling={false}
        onCancelPress={jest.fn()}
      />
    );
    expect(screen.getByText("Booking Has Passed")).toBeTruthy();
  });

  it("calls onCancelPress when Cancel This Booking is pressed", () => {
    const onCancelPress = jest.fn();
    renderWithProviders(
      <BookingResultPanel
        booking={mockBooking}
        restaurant={mockRestaurant}
        compact={false}
        cancelling={false}
        onCancelPress={onCancelPress}
      />
    );
    fireEvent.press(screen.getByText("Cancel This Booking"));
    expect(onCancelPress).toHaveBeenCalled();
  });

  it("copies the reference to the clipboard on web and reverts the label after a timeout", async () => {
    const mockClipboard = jest.fn();
    (navigator as any).clipboard = { writeText: mockClipboard };

    renderWithProviders(
      <BookingResultPanel
        booking={mockBooking}
        restaurant={mockRestaurant}
        compact={false}
        cancelling={false}
        onCancelPress={jest.fn()}
      />
    );
    fireEvent.press(screen.getByText("Copy"));
    expect(mockClipboard).toHaveBeenCalledWith("REF123");
    await waitFor(() => expect(screen.getByText("Copied")).toBeTruthy());
    await waitFor(() => expect(screen.getByText("Copy")).toBeTruthy(), { timeout: 3000 });
  }, 10000);

  it("does not render the calendar/copy actions on native", () => {
    Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });
    renderWithProviders(
      <BookingResultPanel
        booking={mockBooking}
        restaurant={mockRestaurant}
        compact={false}
        cancelling={false}
        onCancelPress={jest.fn()}
      />
    );
    expect(screen.queryByText("ADD TO CALENDAR")).toBeNull();
    expect(screen.queryByText("Copy")).toBeNull();
    // Directions still render on native — Linking.openURL isn't a web-only API.
    expect(screen.getByText("GET DIRECTIONS")).toBeTruthy();
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
  });

  it("geocodes the restaurant address and embeds a map when nominatim returns coordinates", async () => {
    (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ lat: "43.6532", lon: "-79.3832" }],
    });
    renderWithProviders(
      <BookingResultPanel
        booking={mockBooking}
        restaurant={mockRestaurant}
        compact={false}
        cancelling={false}
        onCancelPress={jest.fn()}
      />
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("GET DIRECTIONS")).toBeTruthy());
  });

  it("omits the directions/map card when the restaurant has no address", () => {
    renderWithProviders(
      <BookingResultPanel
        booking={mockBooking}
        restaurant={{ ...mockRestaurant, address: "" }}
        compact={false}
        cancelling={false}
        onCancelPress={jest.fn()}
      />
    );
    expect(screen.queryByText("GET DIRECTIONS")).toBeNull();
  });

  it("switches the calendar/directions layout with the compact prop", () => {
    renderWithProviders(
      <BookingResultPanel
        booking={mockBooking}
        restaurant={mockRestaurant}
        compact
        cancelling={false}
        onCancelPress={jest.fn()}
      />
    );
    expect(screen.getByText("MAPS")).toBeTruthy();
    expect(screen.queryByText("GET DIRECTIONS")).toBeNull();
  });

  it("shows a spinner via the loading prop while cancelling", () => {
    renderWithProviders(
      <BookingResultPanel
        booking={mockBooking}
        restaurant={mockRestaurant}
        compact={false}
        cancelling
        onCancelPress={jest.fn()}
      />
    );
    const button = screen.getByLabelText("Cancel this booking");
    expect(button.props.accessibilityState.busy).toBe(true);
  });
});
