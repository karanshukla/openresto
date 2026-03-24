import React from "react";
import { render, screen } from "@testing-library/react-native";
import RestaurantCard from "@/components/restaurant/RestaurantCard";

// Mock dependencies
jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
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

  it("calculates and displays total tables", () => {
    render(<RestaurantCard restaurant={restaurant} />);
    expect(screen.getByText("3 tables")).toBeTruthy();
  });

  it("calculates and displays total seats", () => {
    render(<RestaurantCard restaurant={restaurant} />);
    expect(screen.getByText("12 seats")).toBeTruthy();
  });

  it("shows 'Book a table' CTA", () => {
    render(<RestaurantCard restaurant={restaurant} />);
    expect(screen.getByText("Book a table")).toBeTruthy();
  });

  it("shows singular 'table' for single table", () => {
    const singleTable = {
      ...restaurant,
      sections: [
        {
          id: 1,
          name: "Main",
          restaurantId: 1,
          tables: [{ id: 1, name: "T1", seats: 2, sectionId: 1 }],
        },
      ],
    };
    render(<RestaurantCard restaurant={singleTable} />);
    expect(screen.getByText("1 table")).toBeTruthy();
  });

  it("renders the initial letter from name", () => {
    render(<RestaurantCard restaurant={restaurant} />);
    // "P" is the initial of "Pasta Place"
    expect(screen.getByText("P")).toBeTruthy();
  });
});
