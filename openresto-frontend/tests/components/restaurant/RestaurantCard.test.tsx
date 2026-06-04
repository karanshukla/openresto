import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import RestaurantCard from "@/components/restaurant/RestaurantCard";
import { fetchAvailability } from "@/api/availability";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("expo-image", () => ({
  Image: ({ testID, source }: any) =>
    require("react").createElement("Image", { testID: testID ?? "expo-image", source }),
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
    // Pin clock to noon UTC so the 23:30 slot is always in the future.
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    try {
      (fetchAvailability as jest.Mock).mockResolvedValue({
        slots: [{ time: "23:30", isAvailable: true }],
      });
      render(<RestaurantCard restaurant={mockRestaurant} />);
      await waitFor(() => expect(screen.getByText("23:30")).toBeTruthy());
    } finally {
      jest.useRealTimers();
    }
  });

  it("filters out unavailable slots", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    try {
      (fetchAvailability as jest.Mock).mockResolvedValue({
        slots: [{ time: "23:30", isAvailable: false }],
      });
      render(<RestaurantCard restaurant={mockRestaurant} />);
      await waitFor(() => expect(screen.getByText("No available slots today")).toBeTruthy());
    } finally {
      jest.useRealTimers();
    }
  });

  it("navigates to booking when 'See details' is pressed", async () => {
    render(<RestaurantCard restaurant={mockRestaurant} />);
    await waitFor(() => expect(screen.getByText("See details")).toBeTruthy());

    fireEvent.press(screen.getByText("See details"));

    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("/(user)/book/1"));
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
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T14:00:00Z")); // fixed noon UTC — outside 23:00-23:59 window
    try {
      render(
        <RestaurantCard restaurant={{ ...mockRestaurant, openTime: "23:00", closeTime: "23:59" }} />
      );
      await waitFor(() => expect(screen.queryByText("Closed")).toBeTruthy());
    } finally {
      jest.useRealTimers();
    }
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

  it("fetches availability when openDays uses day names", async () => {
    // Regression test for: openDays="Mon,Tue,Wed" should still call API
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-05T12:00:00Z")); // Monday
    try {
      (fetchAvailability as jest.Mock).mockResolvedValue({
        slots: [{ time: "23:30", isAvailable: true }],
      });
      const restaurantWithDayNames = {
        ...mockRestaurant,
        openDays: "Mon,Tue,Wed,Thu,Fri,Sat,Sun", // Day names instead of numbers
      };
      render(<RestaurantCard restaurant={restaurantWithDayNames} />);
      await waitFor(() => expect(screen.getByText("23:30")).toBeTruthy());
      expect(fetchAvailability).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("renders restaurant correctly when imageUrl is set", async () => {
    render(<RestaurantCard restaurant={{ ...mockRestaurant, imageUrl: "/media/photo.jpg" }} />);
    await waitFor(() => expect(screen.getByText("Test Bistro")).toBeTruthy());
  });

  it("does not render expo-image when imageUrl is absent", async () => {
    render(<RestaurantCard restaurant={mockRestaurant} />);
    await waitFor(() => expect(screen.queryByTestId("expo-image")).toBeNull());
  });

  it("shows closed when openDays day names exclude today", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-05T12:00:00Z")); // Monday
    try {
      const weekendOnlyRestaurant = {
        ...mockRestaurant,
        openDays: "Sat,Sun", // Weekend only
      };
      render(<RestaurantCard restaurant={weekendOnlyRestaurant} />);
      await waitFor(() => expect(screen.getByText("Closed")).toBeTruthy());
      expect(fetchAvailability).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
