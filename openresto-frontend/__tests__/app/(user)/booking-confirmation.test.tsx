/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import BookingConfirmationScreen from "@/app/(user)/booking-confirmation/[bookingRef]";
import { getBookingByRef, getBookingById } from "@/api/bookings";
import { fetchRestaurantById } from "@/api/restaurants";
import { AppThemeProvider } from "@/context/ThemeContext";
import { BrandProvider } from "@/context/BrandContext";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Platform } from "react-native";

// Mock Platform.OS to web
Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });

// Polyfill fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
  })
) as jest.Mock;

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  Stack: { Screen: () => null },
}));

jest.mock("@/api/bookings");
jest.mock("@/api/restaurants");

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

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 0, height: 0 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
        <AppThemeProvider>
          <BrandProvider>
            {ui}
          </BrandProvider>
        </AppThemeProvider>
      </SafeAreaProvider>
    );
  };

  it("renders success state for alpha reference", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());

    expect(screen.getByText("Booking Confirmed")).toBeTruthy();
    expect(screen.getByText("REF123")).toBeTruthy();
    // Check multiple elements by choosing the first one or being more specific
    expect(screen.getAllByText(/Toronto Resto/).length).toBeGreaterThan(0);
  });

  it("renders success state for numeric id", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "50" });

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());

    expect(getBookingById).toHaveBeenCalledWith(50);
  });

  it("handles copy to clipboard", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123" });

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => screen.getByText("Copy"));

    fireEvent.press(screen.getByText("Copy"));
    expect(mockWriteText).toHaveBeenCalledWith("REF123");
    expect(screen.getByText("Copied")).toBeTruthy();
  });

  it("navigates back to home", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123" });

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => screen.getByText("Back to Restaurants"));

    fireEvent.press(screen.getByText("Back to Restaurants"));
    expect(mockReplace).toHaveBeenCalledWith("/");
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
});
