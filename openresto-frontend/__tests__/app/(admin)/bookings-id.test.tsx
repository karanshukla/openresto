/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import BookingDetailScreen from "@/app/(admin)/bookings/[id]";
import {
  getAdminBooking,
  adminDeleteBooking,
  adminExtendBooking,
  adminRestoreBooking,
  adminUpdateBookingFull,
  sendBookingEmail,
} from "@/api/admin";
import { fetchRestaurants } from "@/api/restaurants";
import { AppThemeProvider } from "@/context/ThemeContext";
import { BrandProvider } from "@/context/BrandContext";
import { SafeAreaProvider } from "react-native-safe-area-context";

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

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(() => ({ id: "10" })),
  useRouter: () => ({ back: mockBack }),
  Stack: { Screen: () => null },
}));

jest.mock("@/api/admin");
jest.mock("@/api/restaurants");

// Mock Modal and window.confirm
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  rn.Modal = ({ children, visible }: any) => (visible ? children : null);
  return rn;
});

// Mock sub-components if they cause string fragmentation
jest.mock("@/components/admin/bookings/ExtendBookingActions", () => {
    const { View, Pressable, Text } = require("react-native");
    return {
        ExtendBookingActions: ({ onExtend }: any) => (
            <View>
                <Pressable testID="extend-30" onPress={() => onExtend(30)}><Text>+30m</Text></Pressable>
            </View>
        )
    };
});

jest.setTimeout(20000);

describe("BookingDetailScreen", () => {
  const mockBooking = {
    id: 10,
    bookingRef: "REF123",
    customerEmail: "test@test.com",
    restaurantId: 1,
    sectionId: 1,
    tableId: 1,
    date: "2026-10-10T12:00:00Z",
    seats: 2,
    isCancelled: false,
    tableName: "T1",
  };

  const mockRestaurants = [
    {
      id: 1,
      name: "Resto A",
      sections: [
        { id: 1, name: "S1", tables: [{ id: 1, name: "T1", seats: 4 }] }
      ]
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (getAdminBooking as jest.Mock).mockResolvedValue(mockBooking);
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    delete (window as any).confirm;
    (window as any).confirm = jest.fn(() => true);
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

  it("renders booking details after loading", async () => {
    renderWithProviders(<BookingDetailScreen />);
    await waitFor(() => expect(screen.queryByTestId("ActivityIndicator")).toBeNull());
    expect(screen.getAllByText(/test@test.com/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/REF123/i)).toBeTruthy();
  });

  it("handles uncancel flow", async () => {
    (getAdminBooking as jest.Mock).mockResolvedValue({ ...mockBooking, isCancelled: true });
    (adminRestoreBooking as jest.Mock).mockResolvedValue(true);
    
    renderWithProviders(<BookingDetailScreen />);
    await waitFor(() => expect(screen.getByText("Restore Booking")).toBeTruthy());

    fireEvent.press(screen.getByText("Restore Booking"));
    fireEvent.press(screen.getByText("Restore"));

    await waitFor(() => expect(adminRestoreBooking).toHaveBeenCalledWith(10));
  });

  it("handles extension flow", async () => {
    (adminExtendBooking as jest.Mock).mockResolvedValue({ endTime: "new-time" });
    renderWithProviders(<BookingDetailScreen />);
    await waitFor(() => screen.getByTestId("extend-30"));

    fireEvent.press(screen.getByTestId("extend-30"));
    await waitFor(() => expect(adminExtendBooking).toHaveBeenCalledWith(10, 30));
  });

  it("handles delete (cancel) flow", async () => {
    (adminDeleteBooking as jest.Mock).mockResolvedValue(true);
    renderWithProviders(<BookingDetailScreen />);
    await waitFor(() => screen.getByText("Cancel Booking"));

    fireEvent.press(screen.getByText("Cancel Booking"));
    // Confirmation button in Modal uses "Cancel Booking" label
    // Trigger button also uses "Cancel Booking" label.
    // ConfirmModal mock renders everything.
    const btns = screen.getAllByText("Cancel Booking");
    fireEvent.press(btns[btns.length - 1]);

    await waitFor(() => expect(adminDeleteBooking).toHaveBeenCalledWith(10));
    expect(mockBack).toHaveBeenCalled();
  });
});
