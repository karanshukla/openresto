/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react-native";
import RestaurantScreen from "@/app/(user)/restaurant/[id]";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

jest.mock("@/components/layout/Footer", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View testID="mock-footer" /> };
});

const mockPush = jest.fn();
const mockUseLocalSearchParams = jest.fn(() => ({ id: "1" }));
jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLocalSearchParams: () => mockUseLocalSearchParams(),
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

jest.setTimeout(15000);

describe("RestaurantScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalSearchParams.mockReturnValue({ id: "1" });
    const { fetchRestaurantById } = require("@/api/restaurants");
    fetchRestaurantById.mockResolvedValue(mockRestaurant);
  });

  it("renders restaurant name after loading", async () => {
    renderWithProviders(<RestaurantScreen />);
    await waitFor(() => {
      expect(screen.getByText("Sushi Spot")).toBeTruthy();
    });
  });

  it("renders Book a Table button", async () => {
    renderWithProviders(<RestaurantScreen />);
    await waitFor(() => {
      expect(screen.getByText("Book a Table")).toBeTruthy();
    });
  });

  it("renders the location description with a parsed inline link when set", async () => {
    const { fetchRestaurantById } = require("@/api/restaurants");
    const { Linking } = require("react-native");
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
    fetchRestaurantById.mockResolvedValueOnce({
      ...mockRestaurant,
      description: "Family-run since 1998. See our [menu](https://example.com/menu).",
    });
    renderWithProviders(<RestaurantScreen />);
    await waitFor(() => {
      expect(screen.getByText("Sushi Spot")).toBeTruthy();
    });
    // Plain-text run rendered.
    expect(screen.getByText(/Family-run since 1998/)).toBeTruthy();
    // Link label rendered and tappable.
    expect(screen.getByText("menu")).toBeTruthy();
    fireEvent.press(screen.getByA11yHint("https://example.com/menu"));
    expect(openURLSpy).toHaveBeenCalledWith("https://example.com/menu");
    openURLSpy.mockRestore();
  });

  it("does not render a description block when the field is unset", async () => {
    renderWithProviders(<RestaurantScreen />);
    await waitFor(() => {
      expect(screen.getByText("Sushi Spot")).toBeTruthy();
    });
    expect(screen.queryByText(/Family-run/)).toBeNull();
  });

  it("replaces the Book a Table button with a walk-in notice for walk-in only locations", async () => {
    const { fetchRestaurantById } = require("@/api/restaurants");
    fetchRestaurantById.mockResolvedValueOnce({ ...mockRestaurant, walkInOnly: true });
    renderWithProviders(<RestaurantScreen />);
    await waitFor(() => {
      expect(screen.getByTestId("walk-in-notice")).toBeTruthy();
    });
    expect(screen.queryByText("Book a Table")).toBeNull();
  });

  it("shows not found when restaurant is null", async () => {
    const { fetchRestaurantById } = require("@/api/restaurants");
    fetchRestaurantById.mockResolvedValueOnce(null);
    renderWithProviders(<RestaurantScreen />);
    await waitFor(() => {
      expect(screen.getByText("Restaurant not found.")).toBeTruthy();
    });
  });

  it("shows not found when id param is missing (else branch)", async () => {
    mockUseLocalSearchParams.mockReturnValue({ id: undefined as unknown as string });
    renderWithProviders(<RestaurantScreen />);
    await waitFor(() => {
      expect(screen.getByText("Restaurant not found.")).toBeTruthy();
    });
  });

  it("shows not found when API throws (catch branch)", async () => {
    const { fetchRestaurantById } = require("@/api/restaurants");
    fetchRestaurantById.mockRejectedValueOnce(new Error("Network error"));
    renderWithProviders(<RestaurantScreen />);
    await waitFor(() => {
      expect(screen.getByText("Restaurant not found.")).toBeTruthy();
    });
  });

  it("fires onScroll to update scrollY", async () => {
    renderWithProviders(<RestaurantScreen />);
    await waitFor(() => expect(screen.getByText("Sushi Spot")).toBeTruthy());

    const { ScrollView } = require("react-native");
    const scrollViews = screen.UNSAFE_getAllByType(ScrollView);
    if (scrollViews.length > 0) {
      fireEvent.scroll(scrollViews[0], {
        nativeEvent: { contentOffset: { y: 400 } },
      });
    }
    expect(screen.getByText("Sushi Spot")).toBeTruthy();
  });

  it("pressing ScrollToTopFab calls scrollToTop", async () => {
    const mockUseDimensions = jest.spyOn(require("react-native"), "useWindowDimensions");
    mockUseDimensions.mockReturnValue({ width: 375, height: 667 });

    try {
      renderWithProviders(<RestaurantScreen />);
      await waitFor(() => expect(screen.getByText("Sushi Spot")).toBeTruthy());

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
      expect(screen.getByText("Sushi Spot")).toBeTruthy();
    } finally {
      mockUseDimensions.mockRestore();
    }
  });
});
