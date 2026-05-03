/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import AdminDashboardScreen from "@/app/(admin)/dashboard";
import { getAdminDashboardStats, AdminDashboardStats } from "@/api/admin";
import { AppThemeProvider } from "@/context/ThemeContext";
import { BrandProvider } from "@/context/BrandContext";
import { SafeAreaProvider } from "react-native-safe-area-context";

global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
  })
) as jest.Mock;

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

const mockStats: AdminDashboardStats = {
  todayCount: 5,
  activeHoldsCount: 3,
  pausedCount: 1,
  totalCovers: 100,
  occupancyData: [10, 20, 30, 40, 50, 60, 70],
  recentBookings: [
    {
      id: 10,
      date: new Date().toISOString(),
      seats: 4,
      customerEmail: "today@test.com",
      restaurantName: "Resto A",
      bookingRef: "ABC123",
    },
  ],
};

jest.setTimeout(15000);

describe("AdminDashboardScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAdminDashboardStats as jest.Mock).mockResolvedValue(mockStats);
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

  it("renders metrics and recent bookings after loading", async () => {
    renderWithProviders(<AdminDashboardScreen />);

    await waitFor(() => expect(screen.getByText("today@test.com")).toBeTruthy());

    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("1 venues are currently paused")).toBeTruthy();
    expect(screen.getByText("100")).toBeTruthy();
    expect(screen.getByText("today@test.com")).toBeTruthy();
  });

  it("renders empty state when there are no recent bookings", async () => {
    (getAdminDashboardStats as jest.Mock).mockResolvedValue({
      ...mockStats,
      recentBookings: [],
    });

    renderWithProviders(<AdminDashboardScreen />);

    await waitFor(() => expect(screen.getByText("No bookings for today yet.")).toBeTruthy());
  });

  it("navigates to bookings list on View all press", async () => {
    renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => screen.getByText("View all →"));

    fireEvent.press(screen.getByText("View all →"));

    expect(mockPush).toHaveBeenCalledWith("/(admin)/bookings");
  });

  it("navigates to quick action routes", async () => {
    renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => screen.getByText("New Booking"));

    fireEvent.press(screen.getByText("New Booking"));
    expect(mockPush).toHaveBeenCalledWith("/(admin)/bookings/new");

    fireEvent.press(screen.getByText("Manage Settings"));
    expect(mockPush).toHaveBeenCalledWith("/(admin)/settings");
  });
});
