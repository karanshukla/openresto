import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import BookScreen from "@/app/(user)/book";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ restaurantId: "1" }),
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  Stack: { Screen: () => null },
}));

const mockRestaurant = {
  id: 1,
  name: "Test Restaurant",
  address: "123 Test St",
  openTime: "09:00",
  closeTime: "22:00",
  openDays: "1,2,3,4,5,6,7",
  timezone: "UTC",
  sections: [
    {
      id: 1,
      name: "Main",
      restaurantId: 1,
      tables: [{ id: 1, name: "T1", seats: 4, sectionId: 1 }],
    },
  ],
};

jest.mock("@/api/restaurants", () => ({
  fetchRestaurantById: jest.fn(() => Promise.resolve(mockRestaurant)),
}));

jest.mock("@/api/bookings", () => ({
  createBooking: jest.fn(),
}));

jest.mock("@/api/holds", () => ({
  createHold: jest.fn(),
  releaseHold: jest.fn(),
}));

describe("BookScreen", () => {
  it("renders restaurant name after loading", async () => {
    render(<BookScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Test Restaurant/)).toBeTruthy();
    });
  });

  it("renders 'Book a table' title", async () => {
    render(<BookScreen />);
    await waitFor(() => {
      expect(screen.getByText("Book a table")).toBeTruthy();
    });
  });

  it("shows not found when restaurant is null", async () => {
    const { fetchRestaurantById } = require("@/api/restaurants");
    fetchRestaurantById.mockResolvedValueOnce(null);
    render(<BookScreen />);
    await waitFor(() => {
      expect(screen.getByText("Restaurant not found.")).toBeTruthy();
    });
  });
});
