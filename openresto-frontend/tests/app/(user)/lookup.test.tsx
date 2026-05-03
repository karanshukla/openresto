/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import LookupScreen from "@/app/(user)/lookup";
import { getBookingByRef, cancelBookingByRef } from "@/api/bookings";
import { fetchRestaurantById } from "@/api/restaurants";
import { fetchCachedBookings } from "@/utils/bookingCache";
import { BrandProvider } from "@/context/BrandContext";
import { AppThemeProvider } from "@/context/ThemeContext";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Alert, Platform, Modal } from "react-native";

// Polyfill fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
  })
) as jest.Mock;

// Mock Modal to always render children
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

// Mock Alert.alert
jest.spyOn(Alert, "alert").mockImplementation(() => {});

jest.mock("@/components/common/ConfirmModal", () => {
  const { View, Pressable, Text } = require("react-native");
  return function MockConfirmModal({ visible, onConfirm, message, confirmLabel }: any) {
    if (!visible) return null;
    return (
      <View testID="confirm-modal">
        <Text>{message}</Text>
        <Pressable onPress={onConfirm}>
          <Text>{confirmLabel || "Confirm"}</Text>
        </Pressable>
      </View>
    );
  };
});

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
    delete (window as any).alert;
    (window as any).alert = jest.fn();
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 0, height: 0 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <AppThemeProvider>
          <BrandProvider>{ui}</BrandProvider>
        </AppThemeProvider>
      </SafeAreaProvider>
    );
  };

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

  it("shows error alert on cancellation failure (native)", async () => {
    // Mock Platform to native
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });

    (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
    (cancelBookingByRef as jest.Mock).mockResolvedValue(false);
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

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Error", expect.any(String)));

    Object.defineProperty(Platform, "OS", { get: () => originalOS, configurable: true });
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
});
