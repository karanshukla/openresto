/**
 * @jest-environment jsdom
 *
 * Covers the booking-submission, walk-in branch, and menu-link behaviour that
 * moved out of the old standalone book/restaurant screens when they were
 * folded into the Locations list (issue #205).
 */
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react-native";
import LocationListItem from "@/components/restaurant/LocationListItem";
import { createBooking } from "@/api/bookings";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("expo-image", () => ({
  Image: () => null,
}));

// Mock Modal so the booking-form-internal pickers render their children.
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  rn.Modal = ({ children, visible }: any) => (visible ? children : null);
  return rn;
});

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/api/availability", () => ({
  fetchAvailability: jest.fn().mockResolvedValue({ slots: [] }),
}));

jest.mock("@/api/bookings", () => ({
  createBooking: jest.fn(),
}));

jest.mock("@/components/booking/BookingForm", () => {
  const { Pressable } = require("react-native");
  return function MockBookingForm({ onSubmit }: any) {
    const mockData = {
      customerEmail: "test@example.com",
      customerName: "Test Guest",
      seats: 2,
      tableId: 101,
      sectionId: 1,
      holdId: "hold_123",
      date: "2026-04-18",
      time: "15:00",
    };
    return <Pressable testID="submit-trigger" onPress={() => onSubmit(mockData)} />;
  };
});

const mockRestaurant = {
  id: 1,
  name: "Toronto Resto",
  address: "123 Test St",
  openTime: "09:00",
  closeTime: "22:00",
  openDays: "1,2,3,4,5,6,7",
  timezone: "America/Toronto",
  sections: [
    {
      id: 1,
      name: "Main",
      restaurantId: 1,
      tables: [{ id: 101, name: "T1", seats: 4, sectionId: 1 }],
    },
  ],
};

const registerRef = jest.fn();
const registerFormRef = jest.fn();
const onExpand = jest.fn();

jest.setTimeout(15000);

describe("LocationListItem", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createBooking as jest.Mock).mockResolvedValue({ id: 50, bookingRef: "REF123" });
  });

  it("renders the location name", async () => {
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByText("Toronto Resto")).toBeTruthy());
  });

  it("renders the inline booking form when expanded for a bookable location", async () => {
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByText("Toronto Resto")).toBeTruthy());
    // MockBookingForm renders when not walk-in only.
    expect(screen.getByTestId("submit-trigger")).toBeTruthy();
  });

  it("registers the form ref and triggers the deep-link scroll callback once expanded by default", async () => {
    const onScrollToForm = jest.fn();
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        defaultExpanded
        registerRef={registerRef}
        registerFormRef={registerFormRef}
        onExpand={onExpand}
        onScrollToForm={onScrollToForm}
      />
    );
    await waitFor(() => expect(screen.getByTestId("submit-trigger")).toBeTruthy());
    expect(registerFormRef).toHaveBeenCalledWith(mockRestaurant.id, expect.anything());
    expect(onScrollToForm).toHaveBeenCalledWith(mockRestaurant.id);
    expect(onScrollToForm).toHaveBeenCalledTimes(1);
  });

  it("navigates to the booking confirmation page on successful submission", async () => {
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByTestId("submit-trigger")).toBeTruthy());

    fireEvent.press(screen.getByTestId("submit-trigger"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        "/booking-confirmation/REF123?email=test%40example.com"
      );
    });
  });

  it("shows a walk-in notice instead of the booking form for walk-in-only locations", async () => {
    renderWithProviders(
      <LocationListItem
        restaurant={{ ...mockRestaurant, walkInOnly: true } as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByTestId("walk-in-notice")).toBeTruthy());
    expect(screen.queryByTestId("submit-trigger")).toBeNull();
  });

  it("renders a View menu link when menuUrl is set and opens it on press", async () => {
    const { Linking } = require("react-native");
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);

    renderWithProviders(
      <LocationListItem
        restaurant={{ ...mockRestaurant, menuUrl: "https://example.com/menu.pdf" } as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByLabelText("View menu")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("View menu"));
    expect(openURLSpy).toHaveBeenCalledWith("https://example.com/menu.pdf");
    openURLSpy.mockRestore();
  });

  it("omits the View menu link when menuUrl is not set", async () => {
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByText("Toronto Resto")).toBeTruthy());
    expect(screen.queryByLabelText("View menu")).toBeNull();
  });

  it("parses the description blurb into a tappable inline link", async () => {
    const { Linking } = require("react-native");
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);

    renderWithProviders(
      <LocationListItem
        restaurant={
          {
            ...mockRestaurant,
            description: "Family-run since 1998. See our [menu](https://example.com/menu).",
          } as any
        }
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByText(/Family-run since 1998/)).toBeTruthy());
    expect(screen.getByText("menu")).toBeTruthy();
    fireEvent.press(screen.getByA11yHint("https://example.com/menu"));
    expect(openURLSpy).toHaveBeenCalledWith("https://example.com/menu");
    openURLSpy.mockRestore();
  });
});
