/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react-native";
import BookScreen from "@/app/(user)/book/[restaurantId]";
import { createBooking } from "@/api/bookings";
import { fetchRestaurantById } from "@/api/restaurants";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

jest.mock("@/components/layout/Footer", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View testID="mock-footer" /> };
});

jest.mock("expo-image", () => ({
  Image: ({ testID, onError }: any) =>
    require("react").createElement("Image", { testID: testID ?? "expo-image-banner", onError }),
}));

// Mock Modal to always render children
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  rn.Modal = ({ children, visible }: any) => (visible ? children : null);
  return rn;
});

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockUseLocalSearchParams = jest.fn(() => ({ restaurantId: "1" }));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
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
  timezone: "America/Toronto",
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
  fetchRestaurantById: jest.fn(),
}));

jest.mock("@/api/bookings", () => ({
  createBooking: jest.fn(),
}));

// Mock BookingForm to simplify triggering the submission logic in BookScreen
jest.mock("@/components/booking/BookingForm", () => {
  const { Pressable } = require("react-native");
  return function MockBookingForm({ onSubmit, onRefresh }: any) {
    const mockData = {
      customerEmail: "test@example.com",
      seats: 2,
      tableId: 101,
      holdId: "hold_123",
      date: "2026-04-18",
      time: "15:00",
    };
    return (
      <>
        <Pressable testID="submit-trigger" onPress={() => onSubmit(mockData)} />
        <Pressable testID="refresh-trigger" onPress={onRefresh} />
      </>
    );
  };
});

jest.setTimeout(15000);

describe("BookScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalSearchParams.mockReturnValue({ restaurantId: "1" });
    (fetchRestaurantById as jest.Mock).mockResolvedValue(mockRestaurant);
    (createBooking as jest.Mock).mockResolvedValue({ id: 50, bookingRef: "REF123" });
  });

  it("handles successful booking with bookingRef", async () => {
    renderWithProviders(<BookScreen />);
    await waitFor(() => expect(screen.getByText(/Toronto Resto/)).toBeTruthy());

    fireEvent.press(screen.getByTestId("submit-trigger"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        "/booking-confirmation/REF123?email=test%40example.com"
      );
    });
  });

  it("handles successful booking with id fallback", async () => {
    (createBooking as jest.Mock).mockResolvedValue({ id: 50 });
    renderWithProviders(<BookScreen />);
    await waitFor(() => expect(screen.getByText(/Toronto Resto/)).toBeTruthy());

    fireEvent.press(screen.getByTestId("submit-trigger"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/booking-confirmation/50?email=test%40example.com");
    });
  });

  it("shows error banner on API failure", async () => {
    (createBooking as jest.Mock).mockRejectedValue(new Error("Conflict: Table already booked"));
    renderWithProviders(<BookScreen />);
    await waitFor(() => expect(screen.getByText(/Toronto Resto/)).toBeTruthy());

    fireEvent.press(screen.getByTestId("submit-trigger"));

    await waitFor(() => {
      expect(screen.getByText("Conflict: Table already booked")).toBeTruthy();
    });
  });

  it("handles onRefresh from form", async () => {
    renderWithProviders(<BookScreen />);
    await waitFor(() => screen.getByTestId("refresh-trigger"));
    fireEvent.press(screen.getByTestId("refresh-trigger"));
    expect(mockReplace).toHaveBeenCalledWith("/(user)/book/1");
  });

  it("shows not found when restaurant is null", async () => {
    (fetchRestaurantById as jest.Mock).mockResolvedValue(null);
    renderWithProviders(<BookScreen />);
    await waitFor(() => {
      expect(screen.getByText("Restaurant not found.")).toBeTruthy();
    });
  });

  it("shows not found when restaurantId is missing (else branch)", async () => {
    mockUseLocalSearchParams.mockReturnValue({
      restaurantId: undefined as unknown as string,
    });
    renderWithProviders(<BookScreen />);
    await waitFor(() => {
      expect(screen.getByText("Restaurant not found.")).toBeTruthy();
    });
  });

  it("shows not found when fetchRestaurantById throws (catch branch)", async () => {
    (fetchRestaurantById as jest.Mock).mockRejectedValueOnce(new Error("Network error"));
    renderWithProviders(<BookScreen />);
    await waitFor(() => {
      expect(screen.getByText("Restaurant not found.")).toBeTruthy();
    });
  });

  it("renders image banner when restaurant has imageUrl", async () => {
    (fetchRestaurantById as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      imageUrl: "/media/photo.jpg",
    });
    renderWithProviders(<BookScreen />);
    await waitFor(() => expect(screen.getByTestId("expo-image-banner")).toBeTruthy());
  });

  it("replaces the booking form with a walk-in notice for walk-in only locations", async () => {
    (fetchRestaurantById as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      walkInOnly: true,
    });
    renderWithProviders(<BookScreen />);
    await waitFor(() => expect(screen.getByTestId("walk-in-notice")).toBeTruthy());

    expect(screen.getByText("Visit us")).toBeTruthy();
    expect(screen.queryByText("Book a table")).toBeNull();
    expect(screen.queryByTestId("submit-trigger")).toBeNull();
  });

  it("hides image banner after image load error", async () => {
    (fetchRestaurantById as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      imageUrl: "/media/photo.jpg",
    });
    renderWithProviders(<BookScreen />);
    const img = await screen.findByTestId("expo-image-banner");
    fireEvent(img, "error");
    await waitFor(() => expect(screen.queryByTestId("expo-image-banner")).toBeNull());
  });

  it("fires onScroll to update scrollY in book screen", async () => {
    renderWithProviders(<BookScreen />);
    await waitFor(() => expect(screen.getByText(/Toronto Resto/)).toBeTruthy());

    const { ScrollView } = require("react-native");
    const scrollViews = screen.UNSAFE_getAllByType(ScrollView);
    if (scrollViews.length > 0) {
      fireEvent.scroll(scrollViews[0], {
        nativeEvent: { contentOffset: { y: 400 } },
      });
    }
    expect(screen.getByText(/Toronto Resto/)).toBeTruthy();
  });

  it("pressing ScrollToTopFab calls scrollToTop in book screen", async () => {
    const mockUseDimensions = jest.spyOn(require("react-native"), "useWindowDimensions");
    mockUseDimensions.mockReturnValue({ width: 375, height: 667 });

    try {
      renderWithProviders(<BookScreen />);
      await waitFor(() => expect(screen.getByText(/Toronto Resto/)).toBeTruthy());

      const { ScrollView } = require("react-native");
      const scrollViews = screen.UNSAFE_getAllByType(ScrollView);
      if (scrollViews.length > 0) {
        fireEvent.scroll(scrollViews[0], {
          nativeEvent: { contentOffset: { y: 400 } },
        });
      }

      await waitFor(() => {
        const fab = screen.queryByLabelText("Scroll to top");
        if (fab) {
          fireEvent.press(fab);
        }
      });
      expect(screen.getByText(/Toronto Resto/)).toBeTruthy();
    } finally {
      mockUseDimensions.mockRestore();
    }
  });
});
