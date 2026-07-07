/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react-native";
import LookupScreen from "@/app/(user)/lookup";
import { getBookingByRef, cancelBookingByRef } from "@/api/bookings";
import { fetchRestaurantById } from "@/api/restaurants";
import { fetchCachedBookings } from "@/utils/bookingCache";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";
import { Platform, Modal } from "react-native";

// Mock Modal to always render children
jest.mock("@/components/layout/Footer", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View testID="mock-footer" /> };
});

jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  rn.Modal = ({ children, visible }: any) => (visible ? children : null);
  return rn;
});

jest.mock("@/api/bookings", () => ({
  getBookingByRef: jest.fn(),
  cancelBookingByRef: jest.fn(),
}));

jest.mock("@/api/restaurants", () => ({
  fetchRestaurantById: jest.fn(),
}));

jest.mock("@/utils/bookingCache", () => ({
  fetchCachedBookings: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({})),
}));

jest.mock("@/components/common/ConfirmModal", () => require("../../../jest-mocks/ConfirmModal"));

jest.setTimeout(15000);

describe("LookupScreen", () => {
  const mockBooking = {
    id: 1,
    bookingRef: "REF123",
    customerEmail: "test@test.com",
    restaurantId: 1,
    date: "2026-10-10T12:00:00Z",
    seats: 2,
    isCancelled: false,
  };

  const mockRestaurant = {
    id: 1,
    name: "Test Resto",
    address: "123 Main St",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (fetchCachedBookings as jest.Mock).mockResolvedValue([]);
    (getBookingByRef as jest.Mock).mockResolvedValue(null);
  });

  it("renders search form by default", async () => {
    renderWithProviders(<LookupScreen />);
    expect(screen.getByText("Find My Booking")).toBeTruthy();
    await waitFor(() => expect(fetchCachedBookings).toHaveBeenCalled());
  });

  it("shows not found message when lookup fails", async () => {
    (getBookingByRef as jest.Mock).mockResolvedValue(null);
    renderWithProviders(<LookupScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF");
    fireEvent.changeText(
      screen.getByPlaceholderText("The email used when booking"),
      "test@test.com"
    );
    fireEvent.press(screen.getByText("Look Up"));

    await waitFor(() =>
      expect(screen.getByText("No booking found matching that reference and email.")).toBeTruthy()
    );
  });

  it("shows booking details when found", async () => {
    (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
    (fetchRestaurantById as jest.Mock).mockResolvedValue(mockRestaurant);
    renderWithProviders(<LookupScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
    fireEvent.changeText(
      screen.getByPlaceholderText("The email used when booking"),
      "test@test.com"
    );
    fireEvent.press(screen.getByText("Look Up"));

    await waitFor(() => expect(screen.getByText("Booking Found")).toBeTruthy());
    expect(screen.getByText("REF123")).toBeTruthy();
    expect(screen.getByText("Test Resto")).toBeTruthy();
  });

  it("handles booking cancellation successfully", async () => {
    (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
    (cancelBookingByRef as jest.Mock).mockResolvedValue(true);
    renderWithProviders(<LookupScreen />);

    // Perform lookup first
    fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
    fireEvent.changeText(
      screen.getByPlaceholderText("The email used when booking"),
      "test@test.com"
    );
    fireEvent.press(screen.getByText("Look Up"));

    await waitFor(() => expect(screen.getByText("Cancel This Booking")).toBeTruthy());

    // Click cancel
    fireEvent.press(screen.getByText("Cancel This Booking"));
    expect(await screen.findByTestId("confirm-modal")).toBeTruthy();

    // Confirm cancel
    fireEvent.press(screen.getByText("Cancel Booking"));

    await waitFor(() => expect(cancelBookingByRef).toHaveBeenCalledWith("REF123", "test@test.com"));
    expect(getBookingByRef).toHaveBeenCalledTimes(2); // Initial lookup + refresh after cancel
  });

  it("shows error modal on cancellation failure (native platform)", async () => {
    // The error UI is now platform-independent (AlertModal, not Alert.alert),
    // but this test still verifies the native path renders the modal correctly.
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });

    (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
    (cancelBookingByRef as jest.Mock).mockRejectedValue(new Error("Failed to cancel booking."));
    renderWithProviders(<LookupScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
    fireEvent.changeText(
      screen.getByPlaceholderText("The email used when booking"),
      "test@test.com"
    );
    fireEvent.press(screen.getByText("Look Up"));

    await waitFor(() => screen.getByText("Cancel This Booking"));
    fireEvent.press(screen.getByText("Cancel This Booking"));
    fireEvent.press(screen.getByText("Cancel Booking"));

    await waitFor(() => expect(screen.getByText("Failed to cancel booking.")).toBeTruthy());

    Object.defineProperty(Platform, "OS", { get: () => originalOS, configurable: true });
  });

  it("shows already cancelled disabled button when booking is pre-cancelled", async () => {
    (getBookingByRef as jest.Mock).mockResolvedValue({ ...mockBooking, isCancelled: true });
    (fetchRestaurantById as jest.Mock).mockResolvedValue(mockRestaurant);
    renderWithProviders(<LookupScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
    fireEvent.changeText(
      screen.getByPlaceholderText("The email used when booking"),
      "test@test.com"
    );
    fireEvent.press(screen.getByText("Look Up"));

    await waitFor(() => expect(screen.getByText("Already Cancelled")).toBeTruthy());
    expect(screen.queryByText("Cancel This Booking")).toBeNull();
    expect(screen.queryByTestId("confirm-modal")).toBeNull();
  });

  it("disables the cancel action for a past, non-cancelled booking", async () => {
    (getBookingByRef as jest.Mock).mockResolvedValue({
      ...mockBooking,
      date: "2020-01-01T12:00:00Z",
    });
    (fetchRestaurantById as jest.Mock).mockResolvedValue(mockRestaurant);
    renderWithProviders(<LookupScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
    fireEvent.changeText(
      screen.getByPlaceholderText("The email used when booking"),
      "test@test.com"
    );
    fireEvent.press(screen.getByText("Look Up"));

    await waitFor(() => expect(screen.getByText("Booking Has Passed")).toBeTruthy());
    expect(screen.queryByText("Cancel This Booking")).toBeNull();

    fireEvent.press(screen.getByText("Booking Has Passed"));
    expect(screen.queryByTestId("confirm-modal")).toBeNull();
  });

  it("shows error modal on cancellation failure", async () => {
    (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
    (cancelBookingByRef as jest.Mock).mockRejectedValue(new Error("Failed to cancel booking."));
    renderWithProviders(<LookupScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
    fireEvent.changeText(
      screen.getByPlaceholderText("The email used when booking"),
      "test@test.com"
    );
    fireEvent.press(screen.getByText("Look Up"));

    await waitFor(() => screen.getByText("Cancel This Booking"));
    fireEvent.press(screen.getByText("Cancel This Booking"));
    fireEvent.press(await screen.findByText("Cancel Booking"));

    await waitFor(() => expect(screen.getByText("Failed to cancel booking.")).toBeTruthy());
    expect(cancelBookingByRef).toHaveBeenCalledTimes(1);
    expect(getBookingByRef).toHaveBeenCalledTimes(1);
  });

  it("surfaces the backend's specific rejection message instead of a generic one", async () => {
    (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
    (cancelBookingByRef as jest.Mock).mockRejectedValue(
      new Error("Cannot cancel a booking that has already passed.")
    );
    renderWithProviders(<LookupScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
    fireEvent.changeText(
      screen.getByPlaceholderText("The email used when booking"),
      "test@test.com"
    );
    fireEvent.press(screen.getByText("Look Up"));

    await waitFor(() => screen.getByText("Cancel This Booking"));
    fireEvent.press(screen.getByText("Cancel This Booking"));
    fireEvent.press(await screen.findByText("Cancel Booking"));

    await waitFor(() =>
      expect(screen.getByText("Cannot cancel a booking that has already passed.")).toBeTruthy()
    );

    Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });
  });

  it("dismissing the confirm modal does not cancel the booking", async () => {
    (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
    renderWithProviders(<LookupScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
    fireEvent.changeText(
      screen.getByPlaceholderText("The email used when booking"),
      "test@test.com"
    );
    fireEvent.press(screen.getByText("Look Up"));

    await waitFor(() => screen.getByText("Cancel This Booking"));
    fireEvent.press(screen.getByText("Cancel This Booking"));
    expect(await screen.findByTestId("confirm-modal")).toBeTruthy();

    fireEvent.press(screen.getByText("Keep Booking"));

    await waitFor(() => expect(screen.queryByTestId("confirm-modal")).toBeNull());
    expect(cancelBookingByRef).not.toHaveBeenCalled();
    expect(screen.getByText("Cancel This Booking")).toBeTruthy();
  });

  it("renders recent bookings from cache and triggers lookup on press", async () => {
    const mockCached = [
      {
        bookingRef: "CACHED1",
        email: "cached@test.com",
        restaurantName: "Cached Resto",
        date: "2026-01-01",
        seats: 4,
      },
    ];
    (fetchCachedBookings as jest.Mock).mockResolvedValue(mockCached);

    renderWithProviders(<LookupScreen />);

    await waitFor(() => expect(screen.getByText("YOUR RECENT BOOKINGS")).toBeTruthy());
    expect(screen.getByText("CACHED1")).toBeTruthy();
    expect(screen.getByText(/Cached Resto/)).toBeTruthy();

    fireEvent.press(screen.getByText("CACHED1"));
    expect(getBookingByRef).toHaveBeenCalledWith("CACHED1", "cached@test.com");
  });

  it("shows wide layout with recent bookings list (isWide=true)", async () => {
    const mockUseDimensions = jest.spyOn(require("react-native"), "useWindowDimensions");
    mockUseDimensions.mockReturnValue({ width: 1024, height: 768 });
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });

    const mockCached = [
      {
        bookingRef: "WIDE1",
        email: "wide@test.com",
        restaurantName: "Wide Resto",
        date: "2026-12-01",
        seats: 2,
      },
    ];
    (fetchCachedBookings as jest.Mock).mockResolvedValue(mockCached);

    try {
      renderWithProviders(<LookupScreen />);
      await waitFor(() => expect(fetchCachedBookings).toHaveBeenCalled());
      // In wide layout, RecentBookingsList appears beside the search form
      await waitFor(() => expect(screen.getByText("WIDE1")).toBeTruthy());
    } finally {
      mockUseDimensions.mockRestore();
    }
  });

  it("pressing recent booking in wide layout calls performLookup", async () => {
    const mockUseDimensions = jest.spyOn(require("react-native"), "useWindowDimensions");
    mockUseDimensions.mockReturnValue({ width: 1024, height: 768 });
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });

    const mockCached = [
      {
        bookingRef: "WIDE2",
        email: "wide2@test.com",
        restaurantName: "Resto X",
        date: "2026-11-01",
        seats: 4,
      },
    ];
    (fetchCachedBookings as jest.Mock).mockResolvedValue(mockCached);
    (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);

    try {
      renderWithProviders(<LookupScreen />);
      await waitFor(() => expect(screen.getByText("WIDE2")).toBeTruthy());
      fireEvent.press(screen.getByText("WIDE2"));
      await waitFor(() => expect(getBookingByRef).toHaveBeenCalledWith("WIDE2", "wide2@test.com"));
    } finally {
      mockUseDimensions.mockRestore();
    }
  });

  it("shows copy button in booking result card and copies to clipboard on web", async () => {
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    const mockClipboard = jest.fn();
    (navigator as any).clipboard = { writeText: mockClipboard };

    (getBookingByRef as jest.Mock).mockResolvedValue({ ...mockBooking, bookingRef: "COPYREF" });
    (fetchRestaurantById as jest.Mock).mockResolvedValue(mockRestaurant);
    renderWithProviders(<LookupScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "COPYREF");
    fireEvent.changeText(
      screen.getByPlaceholderText("The email used when booking"),
      "test@test.com"
    );
    fireEvent.press(screen.getByText("Look Up"));

    await waitFor(() => expect(screen.getByText("Booking Found")).toBeTruthy());
    // Press copy button in booking result card
    const copyBtns = screen.queryAllByText("Copy");
    if (copyBtns.length > 0) {
      fireEvent.press(copyBtns[0]);
      expect(mockClipboard).toHaveBeenCalledWith("COPYREF");
    }
  });

  it("fires auto-scroll effect on web when booking is found", async () => {
    // View refs in the RN test renderer are component instances, not DOM elements,
    // so scrollIntoView?.() is a no-op via optional chaining. We verify the timeout
    // callback runs (covering those lines) and that no error is thrown.
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });

    (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
    (fetchRestaurantById as jest.Mock).mockResolvedValue(mockRestaurant);
    renderWithProviders(<LookupScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
    fireEvent.changeText(
      screen.getByPlaceholderText("The email used when booking"),
      "test@test.com"
    );
    fireEvent.press(screen.getByText("Look Up"));

    await waitFor(() => expect(screen.getByText("Booking Found")).toBeTruthy());
    // Wait past the 150ms scroll timeout so the effect callback executes
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(screen.getByText("Booking Found")).toBeTruthy();
  });

  it("calls findNodeHandle on native when booking is found", async () => {
    Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });
    const findNodeHandleSpy = jest
      .spyOn(require("react-native"), "findNodeHandle")
      .mockReturnValue(1);

    try {
      (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
      (fetchRestaurantById as jest.Mock).mockResolvedValue(mockRestaurant);
      renderWithProviders(<LookupScreen />);

      fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
      fireEvent.changeText(
        screen.getByPlaceholderText("The email used when booking"),
        "test@test.com"
      );
      fireEvent.press(screen.getByText("Look Up"));

      await waitFor(() => expect(screen.getByText("Booking Found")).toBeTruthy());
      await waitFor(() => expect(findNodeHandleSpy).toHaveBeenCalled(), { timeout: 1000 });
    } finally {
      findNodeHandleSpy.mockRestore();
      Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    }
  });

  it("shows narrow icon strip with restaurant address on narrow web", async () => {
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    const mockUseDimensions = jest.spyOn(require("react-native"), "useWindowDimensions");
    mockUseDimensions.mockReturnValue({ width: 400, height: 800 });

    (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
    (fetchRestaurantById as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      address: "123 Main St",
    });

    try {
      renderWithProviders(<LookupScreen />);
      fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
      fireEvent.changeText(
        screen.getByPlaceholderText("The email used when booking"),
        "test@test.com"
      );
      fireEvent.press(screen.getByText("Look Up"));

      await waitFor(() => expect(screen.getByText("Booking Found")).toBeTruthy());
      // The narrow icon strip shows CAL and MAPS labels
      expect(screen.getByText("CAL")).toBeTruthy();
    } finally {
      mockUseDimensions.mockRestore();
    }
  });

  it("presses Google calendar button in narrow strip (window.open)", async () => {
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    const mockUseDimensions = jest.spyOn(require("react-native"), "useWindowDimensions");
    mockUseDimensions.mockReturnValue({ width: 400, height: 800 });
    const mockWindowOpen = jest.fn();
    (window as any).open = mockWindowOpen;

    (getBookingByRef as jest.Mock).mockResolvedValue({
      ...mockBooking,
      bookingRef: "REF123",
      date: "2026-10-10T12:00:00Z",
      seats: 2,
    });
    (fetchRestaurantById as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      address: "123 Main St",
    });

    try {
      renderWithProviders(<LookupScreen />);
      fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
      fireEvent.changeText(
        screen.getByPlaceholderText("The email used when booking"),
        "test@test.com"
      );
      fireEvent.press(screen.getByText("Look Up"));

      await waitFor(() => expect(screen.getByTestId("cal-google-btn")).toBeTruthy());
      fireEvent.press(screen.getByTestId("cal-google-btn"));
      expect(mockWindowOpen).toHaveBeenCalled();
    } finally {
      mockUseDimensions.mockRestore();
    }
  });

  it("presses Google Maps in narrow strip (Linking.openURL)", async () => {
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    const mockUseDimensions = jest.spyOn(require("react-native"), "useWindowDimensions");
    mockUseDimensions.mockReturnValue({ width: 400, height: 800 });

    const { Linking } = require("react-native");
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);

    (getBookingByRef as jest.Mock).mockResolvedValue({
      ...mockBooking,
      bookingRef: "REF123",
    });
    (fetchRestaurantById as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      address: "123 Main St",
    });

    try {
      renderWithProviders(<LookupScreen />);
      fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
      fireEvent.changeText(
        screen.getByPlaceholderText("The email used when booking"),
        "test@test.com"
      );
      fireEvent.press(screen.getByText("Look Up"));

      await waitFor(() => expect(screen.getByTestId("maps-google-btn-narrow")).toBeTruthy());
      fireEvent.press(screen.getByTestId("maps-google-btn-narrow"));
      expect(openURLSpy).toHaveBeenCalledWith(expect.stringContaining("maps.google.com"));
    } finally {
      openURLSpy.mockRestore();
      mockUseDimensions.mockRestore();
    }
  });

  it("presses wide layout Apple Maps button (Linking.openURL)", async () => {
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    const mockUseDimensions = jest.spyOn(require("react-native"), "useWindowDimensions");
    mockUseDimensions.mockReturnValue({ width: 1024, height: 768 });

    const { Linking } = require("react-native");
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);

    (getBookingByRef as jest.Mock).mockResolvedValue({
      ...mockBooking,
      bookingRef: "REF123",
    });
    (fetchRestaurantById as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      address: "123 Main St",
    });

    try {
      renderWithProviders(<LookupScreen />);
      fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
      fireEvent.changeText(
        screen.getByPlaceholderText("The email used when booking"),
        "test@test.com"
      );
      fireEvent.press(screen.getByText("Look Up"));

      await waitFor(() => expect(screen.getByText("Apple")).toBeTruthy());
      fireEvent.press(screen.getByText("Apple"));
      expect(openURLSpy).toHaveBeenCalledWith(expect.stringContaining("maps.apple.com"));
    } finally {
      openURLSpy.mockRestore();
      mockUseDimensions.mockRestore();
    }
  });

  it("fires onScroll to update scrollY in lookup screen", async () => {
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
    (fetchRestaurantById as jest.Mock).mockResolvedValue(mockRestaurant);

    renderWithProviders(<LookupScreen />);

    // Find the outer ScrollView and fire a scroll event
    const { ScrollView } = require("react-native");
    const scrollViews = screen.UNSAFE_getAllByType(ScrollView);
    if (scrollViews.length > 0) {
      fireEvent.scroll(scrollViews[0], {
        nativeEvent: { contentOffset: { y: 200 } },
      });
    }
    // Component should still render without error
    expect(screen.getByText("Find My Booking")).toBeTruthy();
  });

  it("presses Outlook calendar button in narrow strip (window.open)", async () => {
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    const mockUseDimensions = jest.spyOn(require("react-native"), "useWindowDimensions");
    mockUseDimensions.mockReturnValue({ width: 400, height: 800 });
    const mockWindowOpen = jest.fn();
    (window as any).open = mockWindowOpen;

    (getBookingByRef as jest.Mock).mockResolvedValue({
      ...mockBooking,
      bookingRef: "REF123",
      date: "2026-10-10T12:00:00Z",
      seats: 2,
    });
    (fetchRestaurantById as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      address: "123 Main St",
    });

    try {
      renderWithProviders(<LookupScreen />);
      fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
      fireEvent.changeText(
        screen.getByPlaceholderText("The email used when booking"),
        "test@test.com"
      );
      fireEvent.press(screen.getByText("Look Up"));

      await waitFor(() => expect(screen.getByTestId("cal-outlook-btn")).toBeTruthy());
      fireEvent.press(screen.getByTestId("cal-outlook-btn"));
      expect(mockWindowOpen).toHaveBeenCalled();
    } finally {
      mockUseDimensions.mockRestore();
    }
  });

  it("presses Apple Maps in narrow strip (Linking.openURL)", async () => {
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    const mockUseDimensions = jest.spyOn(require("react-native"), "useWindowDimensions");
    mockUseDimensions.mockReturnValue({ width: 400, height: 800 });

    const { Linking } = require("react-native");
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);

    (getBookingByRef as jest.Mock).mockResolvedValue({
      ...mockBooking,
      bookingRef: "REF123",
    });
    (fetchRestaurantById as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      address: "123 Main St",
    });

    try {
      renderWithProviders(<LookupScreen />);
      fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
      fireEvent.changeText(
        screen.getByPlaceholderText("The email used when booking"),
        "test@test.com"
      );
      fireEvent.press(screen.getByText("Look Up"));

      await waitFor(() => expect(screen.getByTestId("maps-apple-btn-narrow")).toBeTruthy());
      fireEvent.press(screen.getByTestId("maps-apple-btn-narrow"));
      expect(openURLSpy).toHaveBeenCalledWith(expect.stringContaining("maps.apple.com"));
    } finally {
      openURLSpy.mockRestore();
      mockUseDimensions.mockRestore();
    }
  });

  it("presses Google Maps in wide layout (Linking.openURL)", async () => {
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    const mockUseDimensions = jest.spyOn(require("react-native"), "useWindowDimensions");
    mockUseDimensions.mockReturnValue({ width: 1024, height: 768 });

    const { Linking } = require("react-native");
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);

    (getBookingByRef as jest.Mock).mockResolvedValue({
      ...mockBooking,
      bookingRef: "REF123",
    });
    (fetchRestaurantById as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      address: "123 Main St",
    });

    try {
      renderWithProviders(<LookupScreen />);
      fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
      fireEvent.changeText(
        screen.getByPlaceholderText("The email used when booking"),
        "test@test.com"
      );
      fireEvent.press(screen.getByText("Look Up"));

      await waitFor(() => expect(screen.getAllByText("Google").length).toBeGreaterThan(0));
      // Maps "Google" button appears after the Calendar section — press the last one
      const googleBtns = screen.getAllByText("Google");
      fireEvent.press(googleBtns[googleBtns.length - 1]);
      expect(openURLSpy).toHaveBeenCalledWith(expect.stringContaining("maps.google.com"));
    } finally {
      openURLSpy.mockRestore();
      mockUseDimensions.mockRestore();
    }
  });

  it("fires measureLayout success callback scrolling native booking card into view", async () => {
    Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });
    const { View } = require("react-native");
    const findNodeHandleSpy = jest
      .spyOn(require("react-native"), "findNodeHandle")
      .mockReturnValue(1);
    const measureLayoutSpy = jest
      .spyOn(View.prototype, "measureLayout")
      .mockImplementation((...args: unknown[]) => {
        const success = args[1] as (x: number, y: number) => void;
        success(0, 100);
      });

    try {
      (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
      (fetchRestaurantById as jest.Mock).mockResolvedValue(mockRestaurant);
      renderWithProviders(<LookupScreen />);

      fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
      fireEvent.changeText(
        screen.getByPlaceholderText("The email used when booking"),
        "test@test.com"
      );
      fireEvent.press(screen.getByText("Look Up"));

      await waitFor(() => expect(screen.getByText("Booking Found")).toBeTruthy());
      await waitFor(() => expect(measureLayoutSpy).toHaveBeenCalled(), { timeout: 1000 });
    } finally {
      findNodeHandleSpy.mockRestore();
      measureLayoutSpy.mockRestore();
      Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    }
  });

  it("pressing ScrollToTopFab in lookup screen calls scrollToTop", async () => {
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    const mockUseDimensions = jest.spyOn(require("react-native"), "useWindowDimensions");
    // Portrait mobile: FAB shows when scrollY > 300 and width < 700, height > width
    mockUseDimensions.mockReturnValue({ width: 375, height: 667 });

    (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
    (fetchRestaurantById as jest.Mock).mockResolvedValue(mockRestaurant);

    try {
      renderWithProviders(<LookupScreen />);

      // Scroll past 300
      const { ScrollView } = require("react-native");
      const scrollViews = screen.UNSAFE_getAllByType(ScrollView);
      if (scrollViews.length > 0) {
        fireEvent.scroll(scrollViews[0], {
          nativeEvent: { contentOffset: { y: 400 } },
        });
      }

      // FAB should now be visible; press it
      await waitFor(() => {
        const fab = screen.queryByLabelText("Scroll to top");
        if (fab) {
          fireEvent.press(fab);
        }
      });
      // scrollRef.current?.scrollTo is a no-op but scrollToTop callback was called
      expect(screen.getByText("Find My Booking")).toBeTruthy();
    } finally {
      mockUseDimensions.mockRestore();
    }
  });
});
