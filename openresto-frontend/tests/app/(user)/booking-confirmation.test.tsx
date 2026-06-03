/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import BookingConfirmationScreen from "@/app/(user)/booking-confirmation/[bookingRef]";
import { getBookingByRef, getBookingById, cancelBookingByRef } from "@/api/bookings";
import { fetchRestaurantById } from "@/api/restaurants";
import { AppThemeProvider } from "@/context/ThemeContext";
import { BrandProvider } from "@/context/BrandContext";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Alert, Platform } from "react-native";

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

jest.mock("@/components/common/ConfirmModal", () => {
  const { View, Pressable, Text } = require("react-native");
  return function MockConfirmModal({
    visible,
    onConfirm,
    onCancel,
    confirmLabel,
    cancelLabel,
  }: any) {
    if (!visible) return null;
    return (
      <View testID="confirm-modal">
        <Pressable onPress={onConfirm}>
          <Text>{confirmLabel || "Confirm"}</Text>
        </Pressable>
        <Pressable onPress={onCancel}>
          <Text>{cancelLabel || "Cancel"}</Text>
        </Pressable>
      </View>
    );
  };
});

// Mock Clipboard
const mockWriteText = jest.fn();
(navigator as any).clipboard = {
  writeText: mockWriteText,
};

jest.spyOn(Alert, "alert").mockImplementation(() => {});

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

  it("shows web alert on cancellation failure", async () => {
    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });
    (cancelBookingByRef as jest.Mock).mockResolvedValue(false);

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => expect(screen.getByText("Cancel This Booking")).toBeTruthy());

    fireEvent.press(screen.getByText("Cancel This Booking"));
    fireEvent.press(await screen.findByText("Cancel Booking"));

    await waitFor(() =>
      expect((window as any).alert).toHaveBeenCalledWith("Failed to cancel booking.")
    );
    expect(screen.queryByText("Booking Cancelled")).toBeNull();
  });

  it("shows native alert on cancellation failure", async () => {
    Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });

    const { useLocalSearchParams } = require("expo-router");
    useLocalSearchParams.mockReturnValue({ bookingRef: "REF123", email: "test@test.com" });
    (cancelBookingByRef as jest.Mock).mockResolvedValue(false);

    renderWithProviders(<BookingConfirmationScreen />);
    await waitFor(() => expect(screen.getByText("Cancel This Booking")).toBeTruthy());

    fireEvent.press(screen.getByText("Cancel This Booking"));
    fireEvent.press(await screen.findByText("Cancel Booking"));

    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith("Error", "Failed to cancel booking.")
    );
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
