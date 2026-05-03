/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import NewBookingScreen from "@/app/(admin)/bookings/new";
import { fetchRestaurants } from "@/api/restaurants";
import { adminCreateBooking } from "@/api/admin";
import { AppThemeProvider } from "@/context/ThemeContext";
import { BrandProvider } from "@/context/BrandContext";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Polyfill fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
  })
) as jest.Mock;

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, back: jest.fn() }),
  Stack: { Screen: () => null },
}));

jest.mock("@/api/admin");
jest.mock("@/api/restaurants");

jest.setTimeout(20000);

describe("NewBookingScreen", () => {
  const mockRestaurants = [
    {
      id: 1,
      name: "Resto A",
      openTime: "09:00",
      closeTime: "22:00",
      sections: [{ id: 1, name: "Main", tables: [{ id: 1, name: "T1", seats: 4 }] }],
    },
    {
      id: 2,
      name: "Resto B",
      sections: [{ id: 2, name: "Patio", tables: [{ id: 2, name: "T2", seats: 2 }] }],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    delete (window as any).confirm;
    (window as any).confirm = jest.fn(() => true);
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 0, height: 0 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <AppThemeProvider>
          <BrandProvider>{ui}</BrandProvider>
        </AppThemeProvider>
      </SafeAreaProvider>
    );
  };

  it("renders form and handles creation", async () => {
    (adminCreateBooking as jest.Mock).mockResolvedValue({ id: 99 });
    const { queryByTestId } = renderWithProviders(<NewBookingScreen />);
    await waitFor(() => expect(queryByTestId("new-booking-spinner")).toBeNull());

    fireEvent.changeText(screen.getByPlaceholderText("guest@example.com"), "new@test.com");
    fireEvent.press(screen.getByText("Create Booking"));

    await waitFor(() => {
      expect(adminCreateBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          customerEmail: "new@test.com",
        })
      );
      expect(mockReplace).toHaveBeenCalledWith("/(admin)/bookings/99");
    });
  });

  it("handles restaurant and section changes", async () => {
    const { queryByTestId } = renderWithProviders(<NewBookingScreen />);
    await waitFor(() => expect(queryByTestId("new-booking-spinner")).toBeNull());
    await waitFor(() => expect(screen.getByText("Resto A")).toBeTruthy());

    fireEvent.press(screen.getByText("Resto A"));
    fireEvent.press(screen.getByText("Resto B"));

    expect(screen.getByText("Patio")).toBeTruthy();
  });

  it("shows error on creation failure", async () => {
    (adminCreateBooking as jest.Mock).mockRejectedValue(new Error("Network Error"));
    const { queryByTestId } = renderWithProviders(<NewBookingScreen />);
    await waitFor(() => expect(queryByTestId("new-booking-spinner")).toBeNull());
    await waitFor(() => screen.getByPlaceholderText("guest@example.com"));

    fireEvent.changeText(screen.getByPlaceholderText("guest@example.com"), "new@test.com");
    fireEvent.press(screen.getByText("Create Booking"));

    await waitFor(() => expect(screen.getByText("Network Error")).toBeTruthy());
  });
});
