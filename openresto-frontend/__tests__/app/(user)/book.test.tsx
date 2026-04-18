import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import BookScreen from "@/app/(user)/book";
import { createBooking } from "@/api/bookings";
import { fetchRestaurantById } from "@/api/restaurants";

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
  name: "Toronto Resto",
  address: "123 Test St",
  openTime: "09:00",
  closeTime: "22:00",
  openDays: "1,2,3,4,5,6,7",
  timezone: "America/Toronto", // UTC-4 in April 2026 (Daylight Savings)
  sections: [
    {
      id: 1,
      name: "Main",
      restaurantId: 1,
      tables: [{ id: 101, name: "T1", seats: 4, sectionId: 1 }],
    },
  ],
};

jest.mock("@/api/restaurants", () => ({
  fetchRestaurantById: jest.fn(() => Promise.resolve(mockRestaurant)),
}));

jest.mock("@/api/bookings", () => ({
  createBooking: jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ bookingRef: "REF123" }) })),
}));

jest.mock("@/api/holds", () => ({
  createHold: jest.fn(),
  releaseHold: jest.fn(),
}));

// Mock BookingForm to simplify triggering the submission logic in BookScreen
jest.mock("@/components/booking/BookingForm", () => {
  const { Pressable } = require("react-native");
  return function MockBookingForm({ onSubmit }: any) {
    const mockData = {
      customerEmail: "test@example.com",
      seats: 2,
      tableId: 101,
      holdId: "hold_123",
      date: "2026-04-18",
      time: "15:00",
    };
    return (
      <Pressable testID="submit-trigger" onPress={() => onSubmit(mockData)} />
    );
  };
});

describe("BookScreen Timezone Logic", () => {
  const performTest = async (timezone: string, localTime: string, expectedUtc: string) => {
    // Override the mock for this specific test case
    (fetchRestaurantById as jest.Mock).mockResolvedValueOnce({
      ...mockRestaurant,
      timezone,
    });

    render(<BookScreen />);
    
    await waitFor(() => expect(screen.getByText(/Toronto Resto/)).toBeTruthy());

    // Mock specific input data
    const trigger = screen.getByTestId("submit-trigger");
    // We need to re-mock the BookingForm to use the passed localTime
    // But since it's already mocked, we'll just check if the conversion logic in BookScreen handles different offsets correctly
    // To do this properly, we need to pass the data through the trigger.
    
    // Actually, I'll update the mock once to handle parameters or use separate mocks.
    // Simpler: Just rely on the current mock for the Toronto case, and add one for Sydney.
  };

  it("converts 3:00 PM Toronto time (EDT, UTC-4) to 19:00 UTC", async () => {
    (fetchRestaurantById as jest.Mock).mockResolvedValueOnce({
      ...mockRestaurant,
      timezone: "America/Toronto",
    });

    render(<BookScreen />);
    await waitFor(() => expect(screen.getByText(/Toronto Resto/)).toBeTruthy());

    fireEvent.press(screen.getByTestId("submit-trigger"));

    await waitFor(() => {
      const callArgs = (createBooking as jest.Mock).mock.calls[(createBooking as jest.Mock).mock.calls.length - 1][0];
      expect(callArgs.date).toBe("2026-04-18T19:00:00.000Z");
    });
  });

  it("converts 3:00 PM London time (BST, UTC+1) to 14:00 UTC", async () => {
    (fetchRestaurantById as jest.Mock).mockResolvedValueOnce({
      ...mockRestaurant,
      timezone: "Europe/London",
    });

    render(<BookScreen />);
    await waitFor(() => expect(screen.getByText(/Toronto Resto/)).toBeTruthy());

    fireEvent.press(screen.getByTestId("submit-trigger"));

    await waitFor(() => {
      const callArgs = (createBooking as jest.Mock).mock.calls[(createBooking as jest.Mock).mock.calls.length - 1][0];
      expect(callArgs.date).toBe("2026-04-18T14:00:00.000Z");
    });
  });

  it("converts 3:00 PM Sydney time (AEST, UTC+10) to 05:00 UTC", async () => {
    (fetchRestaurantById as jest.Mock).mockResolvedValueOnce({
      ...mockRestaurant,
      timezone: "Australia/Sydney",
    });

    render(<BookScreen />);
    await waitFor(() => expect(screen.getByText(/Toronto Resto/)).toBeTruthy());

    fireEvent.press(screen.getByTestId("submit-trigger"));

    await waitFor(() => {
      const callArgs = (createBooking as jest.Mock).mock.calls[(createBooking as jest.Mock).mock.calls.length - 1][0];
      expect(callArgs.date).toBe("2026-04-18T05:00:00.000Z");
    });
  });

  it("renders 'Book a table' title", async () => {
    render(<BookScreen />);
    await waitFor(() => {
      expect(screen.getByText("Book a table")).toBeTruthy();
    });
  });

  it("shows not found when restaurant is null", async () => {
    (fetchRestaurantById as jest.Mock).mockResolvedValueOnce(null);
    render(<BookScreen />);
    await waitFor(() => {
      expect(screen.getByText("Restaurant not found.")).toBeTruthy();
    });
  });
});
