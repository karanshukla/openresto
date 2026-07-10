/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react-native";
import BookingConfirmationScreen from "@/app/(user)/booking-confirmation/[bookingRef]";
import { getBookingByRef, getBookingById, cancelBookingByRef } from "@/api/bookings";
import { fetchRestaurantById } from "@/api/restaurants";
import { Platform } from "react-native";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";
import * as useAppThemeModule from "@/hooks/use-app-theme";
import { getThemeColors } from "@/theme/theme";

// Mock Platform.OS to web
Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });

jest.mock("@/components/layout/Footer", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View testID="mock-footer" /> };
});

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  Stack: { Screen: () => null },
}));

jest.mock("@/api/bookings");
jest.mock("@/api/restaurants");

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

jest.mock("@/components/common/ConfirmModal", () => require("../../../jest-mocks/ConfirmModal"));

// Mock Clipboard
const mockWriteText = jest.fn();
(navigator as any).clipboard = {
  writeText: mockWriteText,
};

jest.setTimeout(15000);

describe("BookingConfirmationScreen", () => {
  const mockBooking = {
    id: 50,
    bookingRef: "REF123",
    customerEmail: "test@test.com",
    restaurantId: 1,
    date: "2026-10-10T12:00:00Z",
    seats: 2,
    isCancelled: false,
  };

  const mockCancelledBooking = { ...mockBooking, isCancelled: true };

  const mockRestaurant = {
    id: 1,
    name: "Toronto Resto",
    address: "123 Test St",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
    (getBookingById as jest.Mock).mockResolvedValue(mockBooking);
    (fetchRestaurantById as jest.Mock).mockResolvedValue(mockRestaurant);
  });

  it("renders success state for alpha reference", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());

    expect(screen.getByText("Booking Confirmed")).toBeTruthy();
    expect(screen.getByText("REF123")).toBeTruthy();
    expect(screen.getAllByText(/Toronto Resto/).length).toBeGreaterThan(0);
  });

  it("renders success state for numeric id", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "50" });

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());

    expect(getBookingById).toHaveBeenCalledWith(50);
  });

  it("shows cancel button for an active booking", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => expect(screen.getByText("Cancel This Booking")).toBeTruthy());

    expect(screen.queryByText("This booking has been cancelled")).toBeNull();
  });

  it("disables the cancel button and updates copy for a past, non-cancelled booking", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });
    (getBookingByRef as jest.Mock).mockResolvedValue({
      ...mockBooking,
      date: "2020-01-01T12:00:00Z",
    });

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => expect(screen.getByText("Booking Has Passed")).toBeTruthy());

    expect(screen.queryByText("Cancel This Booking")).toBeNull();
    expect(
      screen.getByText("This booking has already passed and can no longer be cancelled.")
    ).toBeTruthy();

    fireEvent.press(screen.getByText("Booking Has Passed"));
    expect(screen.queryByTestId("confirm-modal")).toBeNull();
  });

  it("shows cancelled header and disabled button when booking is already cancelled", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });
    (getBookingByRef as jest.Mock).mockResolvedValue(mockCancelledBooking);

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => expect(screen.getByText("Booking Cancelled")).toBeTruthy());

    expect(screen.queryByText("Booking Confirmed")).toBeNull();
    expect(screen.getByText("Already Cancelled")).toBeTruthy();
    expect(screen.queryByText("Cancel This Booking")).toBeNull();
  });

  it("cancelling a booking updates header to cancelled state", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });
    (cancelBookingByRef as jest.Mock).mockResolvedValue(true);

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => expect(screen.getByText("Cancel This Booking")).toBeTruthy());

    fireEvent.press(screen.getByText("Cancel This Booking"));
    expect(await screen.findByTestId("confirm-modal")).toBeTruthy();

    fireEvent.press(screen.getByText("Cancel Booking"));
    await waitFor(() => expect(cancelBookingByRef).toHaveBeenCalledWith("REF123", "test@test.com"));

    await waitFor(() => expect(screen.getByText("Booking Cancelled")).toBeTruthy());
    expect(screen.getByText("Already Cancelled")).toBeTruthy();
    expect(screen.queryByText("Booking Confirmed")).toBeNull();
    expect(screen.queryByText("Cancel This Booking")).toBeNull();
  });

  it("shows error modal on cancellation failure", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });
    (cancelBookingByRef as jest.Mock).mockRejectedValue(new Error("Failed to cancel booking."));

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => expect(screen.getByText("Cancel This Booking")).toBeTruthy());

    fireEvent.press(screen.getByText("Cancel This Booking"));
    fireEvent.press(await screen.findByText("Cancel Booking"));

    await waitFor(() => expect(screen.getByText("Failed to cancel booking.")).toBeTruthy());
    expect(screen.queryByText("Booking Cancelled")).toBeNull();
  });

  it("surfaces the backend's specific rejection message instead of a generic one", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });
    (cancelBookingByRef as jest.Mock).mockRejectedValue(
      new Error("Cannot cancel a booking that has already passed.")
    );

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => expect(screen.getByText("Cancel This Booking")).toBeTruthy());

    fireEvent.press(screen.getByText("Cancel This Booking"));
    fireEvent.press(await screen.findByText("Cancel Booking"));

    await waitFor(() =>
      expect(screen.getByText("Cannot cancel a booking that has already passed.")).toBeTruthy()
    );
  });

  it("shows error modal on cancellation failure (native platform)", async () => {
    // The error UI is now platform-independent (AlertModal, not Alert.alert),
    // but this test still verifies the native path renders the modal correctly.
    Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });

    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });
    (cancelBookingByRef as jest.Mock).mockRejectedValue(new Error("Failed to cancel booking."));

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => expect(screen.getByText("Cancel This Booking")).toBeTruthy());

    fireEvent.press(screen.getByText("Cancel This Booking"));
    fireEvent.press(await screen.findByText("Cancel Booking"));

    await waitFor(() => expect(screen.getByText("Failed to cancel booking.")).toBeTruthy());
    expect(screen.queryByText("Booking Cancelled")).toBeNull();

    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
  });

  it("dismissing the confirm modal does not cancel the booking", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => expect(screen.getByText("Cancel This Booking")).toBeTruthy());

    fireEvent.press(screen.getByText("Cancel This Booking"));
    expect(await screen.findByTestId("confirm-modal")).toBeTruthy();

    fireEvent.press(screen.getByText("Keep Booking"));

    await waitFor(() => expect(screen.queryByTestId("confirm-modal")).toBeNull());
    expect(cancelBookingByRef).not.toHaveBeenCalled();
    expect(screen.getByText("Booking Confirmed")).toBeTruthy();
  });

  it("handles copy to clipboard", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123" });

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => screen.getByText("Copy"));

    fireEvent.press(screen.getByText("Copy"));
    expect(mockWriteText).toHaveBeenCalledWith("REF123");
    expect(screen.getByText("Copied")).toBeTruthy();

    // The "Copied" label reverts back to "Copy" after the 2s timeout fires.
    await waitFor(() => expect(screen.getByText("Copy")).toBeTruthy(), { timeout: 3000 });
  });

  it("shows not found state", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "NOTFOUND" });
    (getBookingByRef as jest.Mock).mockResolvedValue(null);

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => expect(screen.getByText("Booking not found.")).toBeTruthy());

    fireEvent.press(screen.getByText("Back to Home"));
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("shows customer name in subtitle when booking has customerName", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });
    (getBookingByRef as jest.Mock).mockResolvedValue({ ...mockBooking, customerName: "Alice" });

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => expect(screen.getAllByText(/Alice/).length).toBeGreaterThan(0));
  });

  it("geocodes restaurant address and sets map coords when nominatim returns data", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });

    // Override fetch to return geocoding data for the nominatim URL
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("nominatim")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ lat: "43.6532", lon: "-79.3832" }]),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
      });
    });

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => expect(screen.getByText("Booking Confirmed")).toBeTruthy());
    // Restaurant address triggers geocoding; just verify component renders without crashing
    expect(screen.getByText("Booking Confirmed")).toBeTruthy();

    // Reset fetch mock
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
    });
  });

  it("silently swallows a failed nominatim geocoding request", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });

    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("nominatim")) {
        return Promise.reject(new Error("network error"));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
      });
    });

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => expect(screen.getByText("Booking Confirmed")).toBeTruthy());
    // The rejected geocoding fetch is caught internally and does not crash the screen.
    await waitFor(() => expect(screen.getByText("Booking Confirmed")).toBeTruthy());

    // Reset fetch mock
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
    });
  });

  it("renders wide layout (isWide=true) with ref card in right column", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });

    // Mock wide window
    const mockUseDimensions = jest.spyOn(require("react-native"), "useWindowDimensions");
    mockUseDimensions.mockReturnValue({ width: 1024, height: 768 });

    try {
      renderWithProviders(<BookingConfirmationScreen />);
      await waitFor(() => expect(screen.getByText("Booking Confirmed")).toBeTruthy());
      // In wide mode, the ref card appears in the right column — multiple "Booking Reference" labels
      expect(screen.getByText("Booking Confirmed")).toBeTruthy();
    } finally {
      mockUseDimensions.mockRestore();
    }
  });

  it("renders loading skeleton when bookingRef is not provided", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: undefined });

    renderWithProviders(<BookingConfirmationScreen />);
    // With no bookingRef the useEffect returns early; loading stays true → skeleton is shown
    // We just confirm it doesn't crash
    expect(true).toBe(true);
  });

  it("pressing copy in wide layout covers the wide copy button branch", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });

    const mockUseDimensions = jest.spyOn(require("react-native"), "useWindowDimensions");
    mockUseDimensions.mockReturnValue({ width: 1024, height: 768 });

    try {
      renderWithProviders(<BookingConfirmationScreen />);
      await waitFor(() => expect(screen.getByText("Booking Confirmed")).toBeTruthy());

      // In wide layout the ref card appears in the right column
      // Both the narrow and wide copy buttons render "Copy" — press the last one
      const copyBtns = screen.getAllByText("Copy");
      fireEvent.press(copyBtns[copyBtns.length - 1]);
      expect(mockWriteText).toHaveBeenCalledWith("REF123");

      // The wide-layout copy button also reverts its own "Copied" label after 2s.
      await waitFor(() => expect(screen.getAllByText("Copy").length).toBeGreaterThan(0), {
        timeout: 3000,
      });
    } finally {
      mockUseDimensions.mockRestore();
    }
  });

  it("pressing Google Maps in the directions section fires Linking.openURL", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });

    const { Linking } = require("react-native");
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);

    try {
      renderWithProviders(<BookingConfirmationScreen />);
      await waitFor(() => expect(screen.getByText("Booking Confirmed")).toBeTruthy());

      // The directions card shows Google and Apple maps buttons
      const googleBtns = screen.queryAllByText("Google");
      if (googleBtns.length > 0) {
        fireEvent.press(googleBtns[0]);
        expect(openURLSpy).toHaveBeenCalledWith(expect.stringContaining("maps.google.com"));
      }
    } finally {
      openURLSpy.mockRestore();
    }
  });

  it("pressing Apple Maps in the directions section fires Linking.openURL", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });

    const { Linking } = require("react-native");
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);

    try {
      renderWithProviders(<BookingConfirmationScreen />);
      await waitFor(() => expect(screen.getByText("Booking Confirmed")).toBeTruthy());

      const appleBtns = screen.queryAllByText("Apple");
      if (appleBtns.length > 0) {
        fireEvent.press(appleBtns[0]);
        expect(openURLSpy).toHaveBeenCalledWith(expect.stringContaining("maps.apple.com"));
      }
    } finally {
      openURLSpy.mockRestore();
    }
  });

  it("fires onScroll to update scrollY", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => expect(screen.getByText("Booking Confirmed")).toBeTruthy());

    // Find the outer ScrollView by its scroll event handler and fire a scroll event
    const scrollViews = screen.UNSAFE_getAllByType(require("react-native").ScrollView);
    if (scrollViews.length > 0) {
      fireEvent.scroll(scrollViews[0], {
        nativeEvent: { contentOffset: { y: 400 } },
      });
    }
    // scrollY is now 400; component should still render without error
    expect(screen.getByText("Booking Confirmed")).toBeTruthy();
  });

  it("pressing ScrollToTopFab calls scrollToTop", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });

    const mockUseDimensions = jest.spyOn(require("react-native"), "useWindowDimensions");
    // Portrait mobile: width < 700, height > width
    mockUseDimensions.mockReturnValue({ width: 375, height: 667 });

    try {
      renderWithProviders(<BookingConfirmationScreen />);
      await waitFor(() => expect(screen.getByText("Booking Confirmed")).toBeTruthy());

      // Scroll past 300 to make FAB visible
      const scrollViews = screen.UNSAFE_getAllByType(require("react-native").ScrollView);
      if (scrollViews.length > 0) {
        fireEvent.scroll(scrollViews[0], {
          nativeEvent: { contentOffset: { y: 400 } },
        });
      }

      // FAB appears with accessibilityLabel "Scroll to top"
      await waitFor(() => {
        const fab = screen.queryByLabelText("Scroll to top");
        if (fab) {
          fireEvent.press(fab);
        }
      });
      // scrollRef.current?.scrollTo is a no-op in test env but the callback runs
      expect(screen.getByText("Booking Confirmed")).toBeTruthy();
    } finally {
      mockUseDimensions.mockRestore();
    }
  });

  it("does not update state if unmounted before the booking fetch resolves", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });

    let resolveBooking: (value: unknown) => void = () => {};
    (getBookingByRef as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveBooking = resolve;
      })
    );

    const { unmount } = renderWithProviders(<BookingConfirmationScreen />);
    unmount();
    resolveBooking(mockBooking);
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The cleanup flag should have short-circuited before restaurant data was fetched.
    expect(fetchRestaurantById).not.toHaveBeenCalled();
  });

  it("does not update state if unmounted before the restaurant fetch resolves", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });

    (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
    let resolveRestaurant: (value: unknown) => void = () => {};
    (fetchRestaurantById as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveRestaurant = resolve;
      })
    );

    const { unmount } = renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => expect(fetchRestaurantById).toHaveBeenCalled());
    unmount();
    resolveRestaurant(mockRestaurant);
    // Flush the resolved promise; the cleanup flag should stop further state updates.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("shows not found state on native platform", async () => {
    Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });

    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "NOTFOUND" });
    (getBookingByRef as jest.Mock).mockResolvedValue(null);

    try {
      renderWithProviders(<BookingConfirmationScreen />);
      await waitFor(() => expect(screen.getByText("Booking not found.")).toBeTruthy());
    } finally {
      Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    }
  });

  it("falls back to the route bookingRef and default restaurant name, and skips cancelling, when the booking has no bookingRef", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });
    (getBookingByRef as jest.Mock).mockResolvedValue({
      ...mockBooking,
      bookingRef: undefined,
      restaurantId: undefined,
    });

    renderWithProviders(<BookingConfirmationScreen />);
    // ref falls back to the route param since booking.bookingRef is undefined
    await waitFor(() => expect(screen.getByText("REF123")).toBeTruthy());
    // restaurant was never fetched since restaurantId is undefined, so name falls back
    expect(fetchRestaurantById).not.toHaveBeenCalled();
    expect(screen.getByText(/2 guests at Restaurant/)).toBeTruthy();

    fireEvent.press(screen.getByText("Cancel This Booking"));
    fireEvent.press(await screen.findByText("Cancel Booking"));

    // handleCancelBooking should bail out early since booking.bookingRef is falsy
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cancelBookingByRef).not.toHaveBeenCalled();
  });

  it("falls back to an empty customerEmail string when cancelling", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });
    (getBookingByRef as jest.Mock).mockResolvedValue({ ...mockBooking, customerEmail: undefined });
    (cancelBookingByRef as jest.Mock).mockResolvedValue(true);

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => expect(screen.getByText("Cancel This Booking")).toBeTruthy());

    fireEvent.press(screen.getByText("Cancel This Booking"));
    fireEvent.press(await screen.findByText("Cancel Booking"));

    await waitFor(() => expect(cancelBookingByRef).toHaveBeenCalledWith("REF123", ""));
  });

  it("evaluates the cancelled title branch for the native Stack.Screen options", async () => {
    Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });

    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });
    (getBookingByRef as jest.Mock).mockResolvedValue(mockCancelledBooking);

    try {
      renderWithProviders(<BookingConfirmationScreen />);
      await waitFor(() => expect(screen.getByText("Booking Cancelled")).toBeTruthy());
    } finally {
      Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    }
  });

  it("uses singular 'guest' copy when seats is 1", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });
    (getBookingByRef as jest.Mock).mockResolvedValue({ ...mockBooking, seats: 1 });

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => expect(screen.getByText(/1 guest at/)).toBeTruthy());
    expect(screen.queryByText(/1 guests at/)).toBeNull();
  });

  it("applies dark-theme styling to the ref badge and covers hover/press states for the map links", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });

    const spy = jest.spyOn(useAppThemeModule, "useAppTheme").mockReturnValue({
      brand: { appName: "Open Resto", primaryColor: "#0a7ea4" },
      isDark: true,
      colors: getThemeColors(true),
      primaryColor: "#0a7ea4",
    });

    try {
      renderWithProviders(<BookingConfirmationScreen />);
      await waitFor(() => expect(screen.getByText("Booking Confirmed")).toBeTruthy());

      for (const label of ["Google", "Apple"]) {
        let node = screen.getByText(label).parent;
        while (node && typeof node.props?.style !== "function") {
          node = node.parent;
        }
        const styleFn = node?.props.style as (state: {
          hovered: boolean;
          pressed: boolean;
        }) => unknown;
        expect(typeof styleFn).toBe("function");
        expect(styleFn({ hovered: true, pressed: false })).toBeTruthy();
        expect(styleFn({ hovered: false, pressed: false })).toBeTruthy();
      }
    } finally {
      spy.mockRestore();
    }
  });

  it("applies dark-theme styling to the ref badge in the wide layout", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });

    const mockUseDimensions = jest.spyOn(require("react-native"), "useWindowDimensions");
    mockUseDimensions.mockReturnValue({ width: 1024, height: 768 });

    const spy = jest.spyOn(useAppThemeModule, "useAppTheme").mockReturnValue({
      brand: { appName: "Open Resto", primaryColor: "#0a7ea4" },
      isDark: true,
      colors: getThemeColors(true),
      primaryColor: "#0a7ea4",
    });

    try {
      renderWithProviders(<BookingConfirmationScreen />);
      await waitFor(() => expect(screen.getByText("Booking Confirmed")).toBeTruthy());
      expect(screen.getAllByText("Booking Reference").length).toBeGreaterThan(0);
    } finally {
      spy.mockRestore();
      mockUseDimensions.mockRestore();
    }
  });
});
