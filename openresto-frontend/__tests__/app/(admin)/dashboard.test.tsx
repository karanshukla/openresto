import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import AdminDashboardScreen from "@/app/(admin)/dashboard";
import { fetchRestaurants } from "@/api/restaurants";
import { getAdminBookings, getAdminOverview } from "@/api/admin";

// Mock the dependencies
jest.mock("@/api/restaurants");
jest.mock("@/api/admin");
jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));
jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));
// Mock Ionicons to avoid rendering issues in tests
jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => "Ionicons",
}));

const mockRestaurants = [{ id: 1, name: "Test Restaurant", slug: "test-rest" }];

const mockOverview = {
  todayBookings: 2,
  totalBookings: 10,
  totalSeats: 25,
  totalRestaurants: 1,
};

describe("AdminDashboardScreen Flow Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    (getAdminOverview as jest.Mock).mockResolvedValue(mockOverview);
  });

  it("calculates flow slots correctly based on today's bookings", async () => {
    const today = new Date();
    // Create bookings for specific hours in UTC (17=5PM, 19=7PM)
    const mockBookings = [
      {
        id: "1",
        date: new Date(
          Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 17, 0, 0, 0)
        ).toISOString(),
        seats: 4,
        customerEmail: "user1@example.com",
      },
      {
        id: "2",
        date: new Date(
          Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 19, 0, 0, 0)
        ).toISOString(),
        seats: 8,
        customerEmail: "user2@example.com",
      },
    ];
    (getAdminBookings as jest.Mock).mockResolvedValue(mockBookings);

    render(<AdminDashboardScreen />);

    // Wait for the data to load
    await waitFor(() => {
      expect(screen.queryByTestId("ActivityIndicator")).toBeNull();
    });

    // Verify today's flow chart labels are present
    expect(screen.getByText("5PM")).toBeTruthy();
    expect(screen.getByText("6PM")).toBeTruthy();
    expect(screen.getByText("7PM")).toBeTruthy();
    expect(screen.getByText("8PM")).toBeTruthy();
    expect(screen.getByText("9PM")).toBeTruthy();

    // Verify bookings are listed
    expect(screen.getByText("user1@example.com")).toBeTruthy();
    expect(screen.getByText("user2@example.com")).toBeTruthy();
  });

  it("handles zero bookings for flow slots", async () => {
    (getAdminBookings as jest.Mock).mockResolvedValue([]);

    render(<AdminDashboardScreen />);

    await waitFor(() => {
      expect(screen.getByText("No bookings today")).toBeTruthy();
    });

    expect(screen.getByText("5PM")).toBeTruthy();
  });
});
