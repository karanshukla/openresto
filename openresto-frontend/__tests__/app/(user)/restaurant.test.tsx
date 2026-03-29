import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import RestaurantScreen from "@/app/(user)/restaurant/[id]";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLocalSearchParams: () => ({ id: "1" }),
  useRouter: () => ({ push: mockPush }),
  Stack: { Screen: () => null },
}));

const mockRestaurant = {
  id: 1,
  name: "Sushi Spot",
  address: "456 Ocean Ave",
  openTime: "11:00",
  closeTime: "23:00",
  openDays: "1,2,3,4,5",
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

describe("RestaurantScreen", () => {
  it("renders restaurant name after loading", async () => {
    render(<RestaurantScreen />);
    await waitFor(() => {
      expect(screen.getByText("Sushi Spot")).toBeTruthy();
    });
  });

  it("renders Book a Table button", async () => {
    render(<RestaurantScreen />);
    await waitFor(() => {
      expect(screen.getByText("Book a Table")).toBeTruthy();
    });
  });

  it("shows not found when restaurant is null", async () => {
    const { fetchRestaurantById } = require("@/api/restaurants");
    fetchRestaurantById.mockResolvedValueOnce(null);
    render(<RestaurantScreen />);
    await waitFor(() => {
      expect(screen.getByText("Restaurant not found.")).toBeTruthy();
    });
  });
});
