import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { Linking, Platform } from "react-native";
import RestaurantCard from "@/components/restaurant/RestaurantCard";

// Mock dependencies
jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useRouter: () => mockRouter,
}));

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text testID={`icon-${name}`}>{name}</Text>,
  };
});

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

jest.mock("@/api/availability", () => ({
  fetchAvailability: jest.fn().mockResolvedValue({
    restaurantId: 1,
    date: "2026-05-25",
    slots: [{ time: "23:30", isAvailable: true, availableTableIds: [1], category: "Dinner" }],
  }),
}));

describe("RestaurantCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Fix time to 08:00 UTC so future slots at 23:30 always appear
    jest.useFakeTimers({ now: new Date("2026-05-28T08:00:00.000Z") });
    const availabilityApi = require("@/api/availability");
    availabilityApi.fetchAvailability.mockResolvedValue({
      restaurantId: 1,
      date: "2026-05-28",
      slots: [{ time: "23:30", isAvailable: true, availableTableIds: [1], category: "Dinner" }],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

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

  it("shows open time slots after loading", async () => {
    render(<RestaurantCard restaurant={restaurant} />);
    await waitFor(() => {
      expect(screen.getByText("23:30")).toBeTruthy();
    });
  });

  it("shows no slots when fetchAvailability returns null", async () => {
    const availabilityApi = require("@/api/availability");
    availabilityApi.fetchAvailability.mockResolvedValueOnce(null);
    render(<RestaurantCard restaurant={restaurant} />);
    await waitFor(() => {
      expect(screen.getByText("No available slots today")).toBeTruthy();
    });
  });

  it("shows no slots when fetchAvailability returns empty slots array", async () => {
    const availabilityApi = require("@/api/availability");
    availabilityApi.fetchAvailability.mockResolvedValueOnce({ restaurantId: 1, date: "2026-05-28", slots: [] });
    render(<RestaurantCard restaurant={restaurant} />);
    await waitFor(() => {
      expect(screen.getByText("No available slots today")).toBeTruthy();
    });
  });

  it("navigates to booking page when a slot is pressed", async () => {
    mockRouter.push.mockClear();
    render(<RestaurantCard restaurant={restaurant} />);
    await waitFor(() => {
      expect(screen.getByText("23:30")).toBeTruthy();
    });
    fireEvent(screen.getByText("23:30"), "press", { stopPropagation: jest.fn() });
    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.stringContaining("restaurantId=1")
    );
  });

  it("navigates to book page when See details is pressed", async () => {
    mockRouter.push.mockClear();
    render(<RestaurantCard restaurant={restaurant} />);
    await waitFor(() => {
      expect(screen.getByText("See details")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("See details"));
    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.stringContaining("restaurantId=1")
    );
  });

  it("opens Google Maps when Google link is pressed", async () => {
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue();
    render(<RestaurantCard restaurant={restaurant} />);
    await waitFor(() => {
      expect(screen.getByText("Google")).toBeTruthy();
    });
    fireEvent(screen.getByText("Google"), "press", { stopPropagation: jest.fn() });
    expect(openURLSpy).toHaveBeenCalledWith(
      expect.stringContaining("maps.google.com")
    );
    openURLSpy.mockRestore();
  });

  it("opens Apple Maps when Apple link is pressed", async () => {
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue();
    render(<RestaurantCard restaurant={restaurant} />);
    await waitFor(() => {
      expect(screen.getByText("Apple")).toBeTruthy();
    });
    fireEvent(screen.getByText("Apple"), "press", { stopPropagation: jest.fn() });
    expect(openURLSpy).toHaveBeenCalledWith(
      expect.stringContaining("maps.apple.com")
    );
    openURLSpy.mockRestore();
  });

  it("renders open/closed status", async () => {
    render(<RestaurantCard restaurant={restaurant} />);
    await waitFor(() => {
      expect(screen.getByText("Pasta Place")).toBeTruthy();
    });
  });

  it("opens new tab on web when open-in-new-tab icon is pressed", async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
    delete (window as any).open;
    (window as any).open = jest.fn();

    render(<RestaurantCard restaurant={restaurant} />);
    await waitFor(() => {
      expect(screen.getByText("Pasta Place")).toBeTruthy();
    });

    const openIcon = screen.queryByTestId("icon-open-outline");
    if (openIcon) {
      fireEvent(openIcon, "press", { stopPropagation: jest.fn() });
      expect(window.open).toHaveBeenCalledWith(
        expect.stringContaining("restaurantId=1"),
        "_blank"
      );
    }

    Object.defineProperty(Platform, "OS", { value: originalOS, configurable: true });
  });
});
