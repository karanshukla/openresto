import React from "react";
import { render, screen } from "@testing-library/react-native";
import RestaurantCard from "@/components/restaurant/RestaurantCard";

// Mock dependencies
jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

jest.mock("@/api/availability", () => ({
  fetchAvailability: jest.fn().mockResolvedValue({
    restaurantId: 1,
    date: "2026-05-25",
    slots: [{ time: "19:00", isAvailable: true, availableTableIds: [1], category: "Dinner" }],
  }),
}));

describe("RestaurantCard", () => {
  const restaurant = {
    id: 1,
    name: "Pasta Place",
    address: "123 Main St",
    openTime: "09:00",
    closeTime: "22:00",
    openDays: "1,2,3,4,5,6,7",
    timezone: "UTC",
    sections: [
      {
        id: 1,
        name: "Main",
        restaurantId: 1,
        tables: [
          { id: 1, name: "T1", seats: 2, sectionId: 1 },
          { id: 2, name: "T2", seats: 4, sectionId: 1 },
        ],
      },
      {
        id: 2,
        name: "Patio",
        restaurantId: 1,
        tables: [{ id: 3, name: "P1", seats: 6, sectionId: 2 }],
      },
    ],
  };

  it("renders the restaurant name", () => {
    render(<RestaurantCard restaurant={restaurant} />);
    expect(screen.getByText("Pasta Place")).toBeTruthy();
  });

  it("renders the address", () => {
    render(<RestaurantCard restaurant={restaurant} />);
    expect(screen.getByText("123 Main St")).toBeTruthy();
  });

  it("renders map links for the address", () => {
    render(<RestaurantCard restaurant={restaurant} />);
    expect(screen.getByText("Google")).toBeTruthy();
    expect(screen.getByText("Apple")).toBeTruthy();
  });

  it("renders tags when present", () => {
    render(<RestaurantCard restaurant={{ ...restaurant, tags: ["Dog friendly", "Terrace"] }} />);
    expect(screen.getByText("Dog friendly")).toBeTruthy();
    expect(screen.getByText("Terrace")).toBeTruthy();
  });

  it("renders no tags when tags is empty", () => {
    render(<RestaurantCard restaurant={{ ...restaurant, tags: [] }} />);
    expect(screen.queryByText("Dog friendly")).toBeNull();
  });

  describe("walk-in only", () => {
    const { fetchAvailability } = require("@/api/availability");
    // Today's ISO day in UTC (the card's timezone in these fixtures).
    const jsDay = new Date().getUTCDay();
    const todayIso = jsDay === 0 ? 7 : jsDay;

    beforeEach(() => {
      (fetchAvailability as jest.Mock).mockClear();
    });

    it("shows an empty state instead of slots and skips availability", () => {
      render(<RestaurantCard restaurant={{ ...restaurant, walkInOnly: true }} />);
      expect(screen.getByTestId("walk-in-slot-notice")).toBeTruthy();
      expect(screen.getByText("No reservations required")).toBeTruthy();
      expect(screen.queryByText("Available slots")).toBeNull();
      expect(fetchAvailability).not.toHaveBeenCalled();
    });

    it("shows the walk-in badge for walk-in only locations", () => {
      render(<RestaurantCard restaurant={{ ...restaurant, walkInOnly: true }} />);
      expect(screen.getByTestId("walk-in-badge")).toBeTruthy();
      expect(screen.getByText("Walk-ins only")).toBeTruthy();
    });

    it("shows an empty state when today is a walk-in day", () => {
      render(<RestaurantCard restaurant={{ ...restaurant, walkInDays: String(todayIso) }} />);
      expect(screen.getByTestId("walk-in-slot-notice")).toBeTruthy();
      expect(screen.getByText("No reservations required")).toBeTruthy();
      expect(fetchAvailability).not.toHaveBeenCalled();
    });

    it("keeps normal slots when the walk-in day is not today", () => {
      const otherDay = todayIso === 7 ? 1 : todayIso + 1;
      render(<RestaurantCard restaurant={{ ...restaurant, walkInDays: String(otherDay) }} />);
      expect(screen.queryByTestId("walk-in-slot-notice")).toBeNull();
      expect(screen.getByText("Available slots")).toBeTruthy();
      expect(fetchAvailability).toHaveBeenCalled();
    });

    it("always shows the walk-in badge, even on a non-walk-in day", () => {
      const otherDay = todayIso === 7 ? 1 : todayIso + 1;
      render(<RestaurantCard restaurant={{ ...restaurant, walkInDays: String(otherDay) }} />);
      expect(screen.getByTestId("walk-in-badge")).toBeTruthy();
      // Slots still render normally for today alongside the badge.
      expect(screen.getByText("Available slots")).toBeTruthy();
    });

    it("lists multiple walk-in days by name in the badge", () => {
      render(<RestaurantCard restaurant={{ ...restaurant, walkInDays: "6,7" }} />);
      expect(screen.getByText("Walk-ins on Saturdays and Sundays")).toBeTruthy();
    });

    it("shows the plain 'Walk-ins only' badge for a fully walk-in location, ignoring walkInDays", () => {
      render(
        <RestaurantCard restaurant={{ ...restaurant, walkInOnly: true, walkInDays: "6,7" }} />
      );
      expect(screen.getByText("Walk-ins only")).toBeTruthy();
      expect(screen.queryByText("Walk-ins on Saturdays and Sundays")).toBeNull();
    });

    it("does not show the walk-in badge when no walk-in policy is configured", () => {
      render(<RestaurantCard restaurant={restaurant} />);
      expect(screen.queryByTestId("walk-in-badge")).toBeNull();
    });
  });
});
