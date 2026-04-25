/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import AdminDashboardScreen from "@/app/(admin)/dashboard";
import { fetchRestaurants } from "@/api/restaurants";
import { getAdminBookings, getAdminOverview } from "@/api/admin";
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

jest.mock("@/api/restaurants");
jest.mock("@/api/admin");
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  Stack: { Screen: () => null },
}));
jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));
jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

const mockRestaurants = [
  { id: 1, name: "Resto A" },
  { id: 2, name: "Resto B" },
];

const mockOverview = {
  todayBookings: 5,
  totalBookings: 100,
  totalSeats: 250,
  totalRestaurants: 2,
};

jest.setTimeout(15000);

describe("AdminDashboardScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    (getAdminOverview as jest.Mock).mockResolvedValue(mockOverview);
    (getAdminBookings as jest.Mock).mockResolvedValue([]);
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

  it("renders metrics and chart correctly", async () => {
    const today = new Date();
    const mockBookings = [
      { id: 10, date: today.toISOString(), seats: 4, customerEmail: "today@test.com" }
    ];
    (getAdminBookings as jest.Mock).mockResolvedValue(mockBookings);

    renderWithProviders(<AdminDashboardScreen />);

    await waitFor(() => expect(screen.queryByTestId("ActivityIndicator")).toBeNull());

    expect(screen.getByText("5")).toBeTruthy(); // today's bookings
    expect(screen.getByText("100")).toBeTruthy(); // total bookings
    expect(screen.getByText("today@test.com")).toBeTruthy();
  });

  it("switches restaurant and fetches new bookings", async () => {
    renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(screen.getByText("Resto B")).toBeTruthy());

    fireEvent.press(screen.getByText("Resto B"));

    await waitFor(() => {
      expect(getAdminBookings).toHaveBeenCalledWith(2);
    });
  });

  it("navigates to bookings list on View All press", async () => {
    renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => screen.getByText("View all →"));
    fireEvent.press(screen.getByText("View all →"));
    expect(mockPush).toHaveBeenCalledWith("/(admin)/bookings");
  });

  it("navigates to quick action routes", async () => {
    renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => screen.getByText("Add Walk-in"));
    fireEvent.press(screen.getByText("Add Walk-in"));
    expect(mockPush).toHaveBeenCalledWith("/(admin)/bookings/new");
  });
});
