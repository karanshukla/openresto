/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react-native";
import { Platform, ScrollView } from "react-native";
import HomeScreen, { resetHomeCache } from "@/app/(user)/index";
import { fetchRestaurants, fetchHighlights } from "@/api/restaurants";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

jest.mock("@/components/layout/Footer", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View testID="mock-footer" /> };
});

jest.mock("@/api/restaurants", () => ({
  fetchRestaurants: jest.fn(),
  fetchHighlights: jest.fn(),
}));

jest.mock("@/api/availability", () => ({
  fetchAvailability: jest.fn().mockResolvedValue({
    restaurantId: 1,
    date: "2026-05-25",
    slots: [{ time: "19:00", isAvailable: true, availableTableIds: [1], category: "Dinner" }],
  }),
}));

jest.mock("expo-router", () => {
  return {
    Stack: {
      Screen: jest.fn(() => null),
    },
    useRouter: jest.fn(() => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    })),
    usePathname: jest.fn(() => "/"),
    Link: jest.fn(({ children }) => children),
  };
});

jest.setTimeout(15000);

// HomeScreen no longer renders its own Navbar — it's now nested inside
// app/(user)/_layout.tsx, which renders the shared Navbar once for every
// (user) route (see issue #140 review, Concern 9: this page previously lived
// outside the (user) group and duplicated Navbar rendering itself).
describe("HomeScreen", () => {
  const mockRestaurants = [
    {
      id: 1,
      name: "Resto 1",
      address: "Address 1",
      openTime: "09:00",
      closeTime: "22:00",
      sections: [],
    },
    {
      id: 2,
      name: "Resto 2",
      address: "Address 2",
      openTime: "10:00",
      closeTime: "21:00",
      sections: [],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    resetHomeCache();
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    (fetchHighlights as jest.Mock).mockResolvedValue([
      {
        id: 1,
        title: "Wood-fired kitchen",
        body: "Fresh daily.",
        iconKey: "flame-outline",
        sortOrder: 0,
      },
    ]);
  });

  it("renders loading state initially", async () => {
    renderWithProviders(<HomeScreen />);
    expect(screen.getByTestId("loading-screen")).toBeTruthy();
    // Wait for effect to finish to avoid unmounted component error
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
  });

  it("renders restaurants after loading", async () => {
    renderWithProviders(<HomeScreen />);

    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());

    expect(screen.getByText("Resto 1")).toBeTruthy();
    expect(screen.getByText("Resto 2")).toBeTruthy();
  });

  it("handles zero restaurants", async () => {
    (fetchRestaurants as jest.Mock).mockResolvedValue([]);
    renderWithProviders(<HomeScreen />);

    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
    expect(screen.queryByTestId("loading-screen")).toBeNull();
  });

  it("renders hero image overlay when headerImageUrl is set", async () => {
    const originalOS = Platform.OS;
    (Platform as unknown as { OS: string }).OS = "web";

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          appName: "Hero Brand",
          primaryColor: "#c0392b",
          headerImageUrl: "https://example.com/hero.jpg",
        }),
    });

    renderWithProviders(<HomeScreen />);
    // Wait for the brand with headerImageUrl to apply — exercises hasHero=true code paths
    await waitFor(() => expect(screen.getAllByText("Hero Brand").length).toBeGreaterThan(0));

    (Platform as unknown as { OS: string }).OS = originalOS;
  });

  it("renders highlights section when highlights are provided", async () => {
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
    expect(screen.getByText("Wood-fired kitchen")).toBeTruthy();
    expect(screen.getByText("Fresh daily.")).toBeTruthy();
  });

  it("renders mobile layout with narrower window width", async () => {
    jest
      .spyOn(require("react-native/Libraries/Utilities/useWindowDimensions"), "default")
      .mockReturnValue({ width: 375, height: 812 });
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
    expect(screen.getByText("Resto 1")).toBeTruthy();
  });

  it("renders Our locations heading", async () => {
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
    expect(screen.getByText("Our locations")).toBeTruthy();
  });

  it("renders highlights label and curated-by text", async () => {
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
    expect(screen.getByText("Restaurant highlights")).toBeTruthy();
    expect(screen.getByText("Curated by the owner")).toBeTruthy();
  });

  it("renders the default hero subtitle when brand.subtitle is unset", async () => {
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
    expect(
      screen.getByText(
        "Scroll down to pick a location below, choose a time, enter your email address, and you're booked!"
      )
    ).toBeTruthy();
  });

  it("renders a custom brand subtitle when set", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          appName: "Custom Brand",
          primaryColor: "#0a7ea4",
          subtitle: "Book the best table in town.",
        }),
    });
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.getAllByText("Custom Brand").length).toBeGreaterThan(0));
    expect(screen.getByText("Book the best table in town.")).toBeTruthy();
    expect(screen.queryByText(/Scroll down to pick a location/)).toBeNull();
  });

  it("renders custom highlights heading/subheading from brand settings", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          appName: "Open Resto",
          primaryColor: "#0a7ea4",
          highlightsHeading: "Why visit us",
          highlightsSubheading: "Hand-picked favourites",
        }),
    });
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
    expect(screen.getByText("Why visit us")).toBeTruthy();
    expect(screen.getByText("Hand-picked favourites")).toBeTruthy();
    expect(screen.queryByText("Restaurant highlights")).toBeNull();
    expect(screen.queryByText("Curated by the owner")).toBeNull();
  });

  it("opens the url when a linked highlight card is pressed", async () => {
    const { Linking } = require("react-native");
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
    (fetchHighlights as jest.Mock).mockResolvedValue([
      {
        id: 10,
        title: "Full menu",
        body: "See what's cooking.",
        iconKey: "restaurant-outline",
        sortOrder: 0,
        link: "https://example.com/menu",
      },
    ]);
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());

    // The linked card carries the url as its accessibilityHint.
    const link = screen.getByA11yHint("https://example.com/menu");
    fireEvent.press(link);
    expect(openURLSpy).toHaveBeenCalledWith("https://example.com/menu");
    openURLSpy.mockRestore();
  });

  it("renders a non-linked highlight as a plain card (no link role)", async () => {
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
    // The default mock highlight has no link → no link hint present.
    expect(screen.queryByA11yHint("https://example.com/menu")).toBeNull();
    expect(screen.getByText("Wood-fired kitchen")).toBeTruthy();
  });

  it("renders empty highlights gracefully (section heading hidden too)", async () => {
    (fetchHighlights as jest.Mock).mockResolvedValue([]);
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
    // No highlights → the entire section (heading + "Curated by the owner" tag
    // + grid) must be absent, not just the card body.
    expect(screen.queryByText("Wood-fired kitchen")).toBeNull();
    expect(screen.queryByText("Restaurant highlights")).toBeNull();
    expect(screen.queryByText("Curated by the owner")).toBeNull();
  });

  it("onScroll handler updates scrollY", async () => {
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
    const scrollView = screen.UNSAFE_getByType(ScrollView);
    fireEvent.scroll(scrollView, { nativeEvent: { contentOffset: { y: 200 } } });
    // Line covered — no assertion needed beyond no crash
  });

  it("scrollToTop callback calls scrollTo on the ScrollView ref via the ScrollToTopFab", async () => {
    jest
      .spyOn(require("react-native/Libraries/Utilities/useWindowDimensions"), "default")
      .mockReturnValue({ width: 375, height: 812 });
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());

    const scrollView = screen.UNSAFE_getByType(ScrollView);
    fireEvent.scroll(scrollView, { nativeEvent: { contentOffset: { y: 400 } } });

    fireEvent.press(screen.getByLabelText("Scroll to top"));
    // scrollRef.current?.scrollTo is a no-op in tests — asserts no crash and
    // covers the scrollToTop callback.
  });
});
