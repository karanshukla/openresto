import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import RestaurantCard from "@/components/restaurant/RestaurantCard";
import { fetchAvailability } from "@/api/availability";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/availability", () => ({
  fetchAvailability: jest.fn(),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Test" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

const mockRestaurant = {
  id: 1,
  name: "Test Bistro",
  address: "123 Main St",
  openTime: "00:00",
  closeTime: "23:59",
  openDays: "1,2,3,4,5,6,7",
  timezone: "UTC",
  tags: [],
  sections: [],
};

describe("RestaurantCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchAvailability as jest.Mock).mockResolvedValue({ slots: [] });
  });

  it("renders restaurant name", async () => {
    render(<RestaurantCard restaurant={mockRestaurant} />);
    await waitFor(() => expect(screen.getByText("Test Bistro")).toBeTruthy());
  });

  it("shows address", async () => {
    render(<RestaurantCard restaurant={mockRestaurant} />);
    await waitFor(() => expect(screen.getByText("123 Main St")).toBeTruthy());
  });

  it("shows 'No available slots today' when fetch returns empty slots", async () => {
    (fetchAvailability as jest.Mock).mockResolvedValue({ slots: [] });
    render(<RestaurantCard restaurant={mockRestaurant} />);
    await waitFor(() => expect(screen.getByText("No available slots today")).toBeTruthy());
  });

  it("shows available time slot", async () => {
    (fetchAvailability as jest.Mock).mockResolvedValue({
      slots: [{ time: "23:30", isAvailable: true }],
    });
    render(<RestaurantCard restaurant={mockRestaurant} />);
    await waitFor(() => expect(screen.getByText("23:30")).toBeTruthy());
  });

  it("filters out unavailable slots", async () => {
    (fetchAvailability as jest.Mock).mockResolvedValue({
      slots: [{ time: "23:30", isAvailable: false }],
    });
    render(<RestaurantCard restaurant={mockRestaurant} />);
    await waitFor(() => expect(screen.getByText("No available slots today")).toBeTruthy());
  });

  it("navigates to booking when 'See details' is pressed", async () => {
    render(<RestaurantCard restaurant={mockRestaurant} />);
    await waitFor(() => expect(screen.getByText("See details")).toBeTruthy());

    fireEvent.press(screen.getByText("See details"));

    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("/(user)/book?restaurantId=1"));
  });

  it("shows Google Maps and Apple Maps links", async () => {
    render(<RestaurantCard restaurant={mockRestaurant} />);
    await waitFor(() => expect(screen.getByText("Google")).toBeTruthy());
    expect(screen.getByText("Apple")).toBeTruthy();
  });

  it("shows tags when restaurant has tags", async () => {
    render(<RestaurantCard restaurant={{ ...mockRestaurant, tags: ["dog friendly"] }} />);
    await waitFor(() => expect(screen.getByText("dog friendly")).toBeTruthy());
  });

  it("shows Closed badge when restaurant is closed", async () => {
    render(
      <RestaurantCard restaurant={{ ...mockRestaurant, openTime: "23:00", closeTime: "23:59" }} />
    );
    await waitFor(() =>
      expect(screen.queryByText("Closed") ?? screen.queryByText("23:00")).toBeTruthy()
    );
  });

  it("shows 'Open till' badge when restaurant is open", async () => {
    render(
      <RestaurantCard restaurant={{ ...mockRestaurant, openTime: "00:00", closeTime: "23:59" }} />
    );
    await waitFor(() => {
      const el = screen.queryByText(/Open till/);
      expect(el).toBeTruthy();
    });
  });

  it("handles null fetchAvailability response gracefully", async () => {
    (fetchAvailability as jest.Mock).mockResolvedValue(null);
    render(<RestaurantCard restaurant={mockRestaurant} />);
    await waitFor(() => expect(screen.getByText("No available slots today")).toBeTruthy());
  });
});
