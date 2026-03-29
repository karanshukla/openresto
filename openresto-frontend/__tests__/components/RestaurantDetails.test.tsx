import React from "react";
import { render, screen } from "@testing-library/react-native";
import RestaurantDetails from "@/components/restaurant/RestaurantDetails";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

describe("RestaurantDetails", () => {
  const restaurant = {
    id: 1,
    name: "Sushi Spot",
    address: "456 Ocean Ave",
    openTime: "11:00",
    closeTime: "23:00",
    openDays: "1,2,3,4,5",
    timezone: "America/New_York",
    sections: [
      {
        id: 1,
        name: "Indoor",
        restaurantId: 1,
        tables: [
          { id: 1, name: "A1", seats: 2, sectionId: 1 },
          { id: 2, name: "A2", seats: 4, sectionId: 1 },
        ],
      },
      {
        id: 2,
        name: "Outdoor",
        restaurantId: 1,
        tables: [{ id: 3, name: "B1", seats: 6, sectionId: 2 }],
      },
    ],
  };

  it("renders the restaurant name", () => {
    render(<RestaurantDetails restaurant={restaurant} />);
    expect(screen.getByText("Sushi Spot")).toBeTruthy();
  });

  it("renders the address", () => {
    render(<RestaurantDetails restaurant={restaurant} />);
    expect(screen.getByText(/456 Ocean Ave/)).toBeTruthy();
  });

  it("renders section names", () => {
    render(<RestaurantDetails restaurant={restaurant} />);
    expect(screen.getByText("Indoor")).toBeTruthy();
    expect(screen.getByText("Outdoor")).toBeTruthy();
  });

  it("renders table names", () => {
    render(<RestaurantDetails restaurant={restaurant} />);
    expect(screen.getByText("A1")).toBeTruthy();
    expect(screen.getByText("A2")).toBeTruthy();
    expect(screen.getByText("B1")).toBeTruthy();
  });

  it("renders table seat counts", () => {
    render(<RestaurantDetails restaurant={restaurant} />);
    // Should show seat counts somewhere
    expect(screen.getByText(/2 seats/)).toBeTruthy();
    expect(screen.getByText(/4 seats/)).toBeTruthy();
  });
});
