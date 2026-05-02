/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import AdminBookingsScreen from "@/app/(admin)/bookings/index";
import { getAdminBookings, getRestaurants } from "@/api/admin";

jest.mock("@/api/admin", () => ({
  getAdminBookings: jest.fn(),
  getRestaurants: jest.fn(),
}));

jest.mock("expo-router", () => {
  const React = require("react");
  const Stack = {
    Screen: () => null,
  };
  return {
    Stack,
    useRouter: () => ({ push: jest.fn() }),
  };
});

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Test App", primaryColor: "#000" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

// Mock fetch for restaurants fetch in Sidebar or elsewhere
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve([{ id: 1, name: "Resto 1" }]),
  })
) as jest.Mock;

jest.mock("@/api/restaurants", () => ({
  fetchRestaurants: jest.fn().mockResolvedValue([{ id: 1, name: "Resto 1" }]),
}));

describe("AdminBookingsScreen", () => {
  const mockRestaurants = [{ id: 1, name: "Resto 1" }];
  const mockBookings = [
    {
      id: 1,
      reference: "REF1",
      customerEmail: "john@example.com",
      status: "active",
      date: new Date().toISOString(),
      seats: 2,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (getRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    (getAdminBookings as jest.Mock).mockResolvedValue(mockBookings);
  });

  it("renders bookings after loading", async () => {
    render(<AdminBookingsScreen />);

    await waitFor(() => {
      expect(screen.getByText("john@example.com")).toBeTruthy();
    });
  });

  it("filters bookings by status", async () => {
    render(<AdminBookingsScreen />);

    const activeFilter = await screen.findByText("Active");
    fireEvent.press(activeFilter);

    await waitFor(() => {
      expect(getAdminBookings).toHaveBeenCalledWith(1, undefined, "active");
    });
  });
});
