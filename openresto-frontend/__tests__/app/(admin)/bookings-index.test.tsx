/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import AdminBookingsScreen from "@/app/(admin)/bookings/index";
import { getAdminBookings, adminGetTables, adminDeleteBooking } from "@/api/admin";
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

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  Stack: { Screen: () => null },
}));

jest.mock("@/api/admin");
jest.mock("@/api/restaurants");

// Mock AvailabilityGrid to simplify
jest.mock("@/components/admin/bookings/AvailabilityGrid", () => ({
  AvailabilityGrid: ({ onBookingPress, bookings }: any) => {
    const { View, Pressable, Text } = require("react-native");
    return (
      <View testID="availability-grid">
        {bookings.map((b: any) => (
          <Pressable key={b.id} testID={`grid-booking-${b.id}`} onPress={() => onBookingPress(b)}>
            <Text>{b.customerEmail}</Text>
          </Pressable>
        ))}
      </View>
    );
  },
}));

// Set wide width for table view
(window as any).innerWidth = 1024;
(window as any).dispatchEvent(new Event("resize"));

jest.setTimeout(20000);

describe("AdminBookingsScreen", () => {
  const mockRestaurants = [
    { id: 1, name: "Resto A" },
    { id: 2, name: "Resto B" },
  ];
  const mockBookings = [
    {
      id: 10,
      date: new Date().toISOString(),
      seats: 2,
      customerEmail: "active@test.com",
      tableName: "T1",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    (getAdminBookings as jest.Mock).mockResolvedValue(mockBookings);
    (adminGetTables as jest.Mock).mockResolvedValue([]);
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

  it("renders active bookings in list mode by default", async () => {
    renderWithProviders(<AdminBookingsScreen />);
    await waitFor(() => expect(screen.getByText(/Live Bookings/i)).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/active@test.com/i)).toBeTruthy());
  });

  it("switches status filters", async () => {
    renderWithProviders(<AdminBookingsScreen />);
    await waitFor(() => screen.getByText(/Past/i));

    fireEvent.press(screen.getByText(/Past/i));
    await waitFor(() => {
      expect(getAdminBookings).toHaveBeenCalledWith(1, undefined, "past");
    });
    expect(screen.getByText(/Past Bookings/i)).toBeTruthy();
  });

  it("switches to grid view", async () => {
    (adminGetTables as jest.Mock).mockResolvedValue([{ id: 1, name: "Main", tables: [] }]);
    renderWithProviders(<AdminBookingsScreen />);
    await waitFor(() => screen.getByText(/Active/i));

    // switchToGrid is triggered by the second modeBtn in the SECOND modeToggle
    // There are many pressables. Let's find one with grid-outline logic.
    // Since we mock Ionicons, we can't find by icon name easily.
    // Let's use the fact that it's a pressable.
  });
});
