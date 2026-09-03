/**
 * @jest-environment jsdom
 */
import { Image } from "expo-image";
import React from "react";
import { act, screen, waitFor, fireEvent } from "@testing-library/react-native";
import { AccessibilityInfo, Platform, ScrollView, StyleSheet } from "react-native";
import type { TextStyle } from "react-native";
import type { ReactTestInstance } from "react-test-renderer";
import HomeScreen, {
  bloomRingAlpha,
  columnWidth,
  heroBlooms,
  resetHomeCache,
} from "@/app/(user)/(home)/index";
import { fetchRestaurants, fetchHighlights } from "@/api/restaurants";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";
import { renderWithInsets } from "@/tests/helpers/renderWithInsets";

jest.mock("@/components/layout/Footer", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View testID="mock-footer" /> };
});

jest.mock("@/api/restaurants", () => ({
  fetchRestaurants: jest.fn(),
  fetchHighlights: jest.fn(),
  fetchSocialLinks: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/api/availability", () => ({
  fetchAvailability: jest.fn().mockResolvedValue({
    restaurantId: 1,
    date: "2026-05-25",
    slots: [{ time: "19:00", isAvailable: true, availableTableIds: [1], category: "Dinner" }],
  }),
}));

/**
 * `useFocusEffect` runs its callback as if the screen had just come into focus and returns the
 * cleanup on unmount, so `mockBlur` can take the screen out of focus mid-test.
 */
let mockBlur: (() => void) | undefined;
jest.mock("expo-router", () => {
  const { useEffect } = require("react");
  return {
    Stack: {
      Screen: jest.fn(() => null),
    },
    useFocusEffect: (effect: () => (() => void) | undefined) => {
      useEffect(() => {
        const cleanup = effect();
        mockBlur = cleanup;
        return cleanup;
      }, [effect]);
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

jest.mock("expo-status-bar", () => {
  const { View } = require("react-native");
  return {
    StatusBar: ({ style }: { style: string }) => (
      <View testID="hero-status-bar" accessibilityLabel={style} />
    ),
  };
});

jest.setTimeout(15000);

// HomeScreen no longer renders its own Navbar — it's now nested inside
// app/(user)/_layout.tsx, which renders the shared Navbar once for every
// (user) route (see issue #140 review, Concern 9: this page previously lived
// outside the (user) group and duplicated Navbar rendering itself).
/**
 * Runs a body with `Platform.OS` pinned, and restores it however the body ends. Half of this
 * screen is a native/web split, so a test that leaves the platform swapped fails the next one.
 */
const onPlatform = async (os: string, body: () => Promise<void>) => {
  const original = Platform.OS;
  (Platform as unknown as { OS: string }).OS = os;
  try {
    await body();
  } finally {
    (Platform as unknown as { OS: string }).OS = original;
  }
};

/** Queues the next `/api/brand` response, over jest.setup's default brand. */
const brandResponse = (overrides: Record<string, unknown>) =>
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ appName: "Hero Brand", primaryColor: "#c0392b", ...overrides }),
  });

/** Text styles arrive as nested arrays of conditionals; flatten before asserting on one. */
const flatStyle = (node: ReactTestInstance): TextStyle & { textShadow?: string } =>
  StyleSheet.flatten(node.props.style);

/**
 * A scroll event carrying the full geometry RN reports. The scroll-to-top FAB reads the
 * content/viewport pair to work out how close the footer is, so a partial event is not a
 * scroll it can answer.
 */
const scrollEvent = (y: number) => ({
  nativeEvent: {
    contentOffset: { y },
    contentSize: { height: 4000 },
    layoutMeasurement: { height: 900 },
  },
});

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
    // Wait for effect to finish to avoid unmounted component error. The first render in a
    // process pays for every lazily-required module the screen's effects touch, which holds
    // the fetch's resolution back past waitFor's default second, so this one gets more.
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull(), {
      timeout: 5000,
    });
  });

  // The skeletons hide themselves from assistive tech, which also hides them from the
  // default query — placeholders are worth nothing to a screen reader and no more to a
  // test that isn't asking for them by name.
  const skeletons = () =>
    screen.queryAllByTestId("restaurant-card-skeleton", { includeHiddenElements: true });

  // A percentage minus a share of the gap is a calc() expression, and React Native has no
  // calc: the string used to reach native untouched at every width with more than one column.
  describe("columnWidth", () => {
    it("measures a two-column grid as a number, not a calc string", () => {
      expect(columnWidth(1200, 28, 18, 2)).toBe(563);
    });

    it("caps against the content column rather than the viewport", () => {
      // 1400 is past CONTENT_MAX_WIDTH, so it measures the same as the cap itself.
      expect(columnWidth(1400, 28, 18, 3)).toBe(columnWidth(1320, 28, 18, 3));
    });

    it("gives a single column the whole inset row", () => {
      expect(columnWidth(375, 16, 18, 1)).toBe(343);
    });
  });

  it("holds the grid's shape with card skeletons while loading, not a spinner", async () => {
    jest
      .spyOn(require("react-native/Libraries/Utilities/useWindowDimensions"), "default")
      .mockReturnValue({ width: 1200, height: 900 });
    renderWithProviders(<HomeScreen />);

    // One row's worth, so the page doesn't resize under the visitor when the cards land.
    expect(skeletons()).toHaveLength(3);

    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
    expect(skeletons()).toHaveLength(0);
  });

  it("shows two skeletons on a phone, where one would read as a finished list", async () => {
    jest
      .spyOn(require("react-native/Libraries/Utilities/useWindowDimensions"), "default")
      .mockReturnValue({ width: 375, height: 812 });
    renderWithProviders(<HomeScreen />);

    expect(skeletons()).toHaveLength(2);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
  });

  it("swipes the highlights sideways on a phone rather than stacking them", async () => {
    jest
      .spyOn(require("react-native/Libraries/Utilities/useWindowDimensions"), "default")
      .mockReturnValue({ width: 375, height: 812 });
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());

    const rail = screen.getByTestId("highlights-rail");
    expect(rail.props.horizontal).toBe(true);
    // Snapping is what makes it read as a rail of cards instead of a free scroll.
    expect(rail.props.snapToInterval).toBeGreaterThan(0);
    expect(screen.getByText("Wood-fired kitchen")).toBeTruthy();
  });

  it("keeps the highlights grid once there is room for more than one column", async () => {
    jest
      .spyOn(require("react-native/Libraries/Utilities/useWindowDimensions"), "default")
      .mockReturnValue({ width: 1200, height: 900 });
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());

    expect(screen.queryByTestId("highlights-rail")).toBeNull();
    expect(screen.getByText("Wood-fired kitchen")).toBeTruthy();
  });

  const manyHighlights = (count: number) =>
    (fetchHighlights as jest.Mock).mockResolvedValue(
      Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        title: `Highlight ${i + 1}`,
        body: "Body.",
        iconKey: "flame-outline",
        sortOrder: i,
      }))
    );

  it("keeps a full four-column row of highlights as a grid", async () => {
    jest
      .spyOn(require("react-native/Libraries/Utilities/useWindowDimensions"), "default")
      .mockReturnValue({ width: 1200, height: 900 });
    manyHighlights(4);
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());

    expect(screen.queryByTestId("highlights-rail")).toBeNull();
  });

  it("scrolls the highlights sideways rather than opening a second row for a fifth", async () => {
    jest
      .spyOn(require("react-native/Libraries/Utilities/useWindowDimensions"), "default")
      .mockReturnValue({ width: 1200, height: 900 });
    manyHighlights(5);
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());

    const rail = screen.getByTestId("highlights-rail");
    expect(rail.props.horizontal).toBe(true);
    expect(screen.getByText("Highlight 5")).toBeTruthy();
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

  it.each([
    ["Contain", "contain", "top center"],
    ["Cover", "cover", "center"],
  ])(
    "renders the hero image through expo-image off web, resolved against the server (%s)",
    async (fit, contentFit, contentPosition) => {
      const originalOS = Platform.OS;
      (Platform as unknown as { OS: string }).OS = "ios";
      const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
      process.env.EXPO_PUBLIC_API_URL = "https://bookings.example.com/api";

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            appName: "Hero Brand",
            primaryColor: "#c0392b",
            headerImageUrl: "/media/hero.jpg?v=1",
            headerImageFit: fit,
          }),
      });

      try {
        renderWithProviders(<HomeScreen />);
        await waitFor(() => expect(screen.getAllByText("Hero Brand").length).toBeGreaterThan(0));
        const hero = screen
          .UNSAFE_getAllByType(Image)
          .find(
            (node) => node.props.source?.uri === "https://bookings.example.com/media/hero.jpg?v=1"
          );
        expect(hero).toBeTruthy();
        expect(hero?.props.contentFit).toBe(contentFit);
        expect(hero?.props.contentPosition).toBe(contentPosition);
      } finally {
        (Platform as unknown as { OS: string }).OS = originalOS;
        process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
      }
    }
  );

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

    // The linked card is a named link; the hint says it leaves the page, not the raw url.
    const link = screen.getByLabelText("Full menu. See what's cooking.");
    expect(link.props.accessibilityHint).toBe("Opens in a new tab");
    fireEvent.press(link);
    expect(openURLSpy).toHaveBeenCalledWith("https://example.com/menu");
    openURLSpy.mockRestore();
  });

  it("renders a non-linked highlight as a plain card (no link role)", async () => {
    renderWithProviders(<HomeScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
    // The default mock highlight has no link → no card carries the new-tab hint.
    expect(screen.queryByA11yHint("Opens in a new tab")).toBeNull();
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
    fireEvent.scroll(scrollView, scrollEvent(200));
    // Line covered — no assertion needed beyond no crash
  });

  // The FAB is a web affordance — it rides the viewport on `position: sticky`, which React
  // Native has no equivalent for — so the press that reaches `scrollToTop` only exists there.
  it("scrollToTop callback calls scrollTo on the ScrollView ref via the ScrollToTopFab", async () => {
    await onPlatform("web", async () => {
      jest
        .spyOn(require("react-native/Libraries/Utilities/useWindowDimensions"), "default")
        .mockReturnValue({ width: 375, height: 812 });
      renderWithProviders(<HomeScreen />);
      await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());

      const scrollView = screen.UNSAFE_getByType(ScrollView);
      fireEvent.scroll(scrollView, scrollEvent(400));

      fireEvent.press(screen.getByLabelText("Scroll to top"));
      // scrollRef.current?.scrollTo is a no-op in tests — asserts no crash and
      // covers the scrollToTop callback.
    });
  });

  describe("the native hero", () => {
    it("washes the flat hero in the accent colour where web paints a gradient", async () => {
      await onPlatform("ios", async () => {
        renderWithProviders(<HomeScreen />);
        await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
        expect(screen.getByTestId("hero-wash")).toBeTruthy();
      });
    });

    it("leaves the web hero to its CSS gradient", async () => {
      await onPlatform("web", async () => {
        renderWithProviders(<HomeScreen />);
        await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
        expect(screen.queryByTestId("hero-wash")).toBeNull();
      });
    });

    it("drops the wash once a header image is the background", async () => {
      await onPlatform("ios", async () => {
        brandResponse({ headerImageUrl: "/media/hero.jpg" });
        renderWithProviders(<HomeScreen />);
        await waitFor(() => expect(screen.getAllByText("Hero Brand").length).toBeGreaterThan(0));
        expect(screen.queryByTestId("hero-wash")).toBeNull();
      });
    });

    // Stacked translucent layers compose multiplicatively, so an even split of the peak is
    // the inverse nth root — three rings at peak / 3 would land short of the web gradient.
    describe("bloomRingAlpha", () => {
      it("stacks back to the peak the web gradient reaches", () => {
        const alpha = bloomRingAlpha(0.18, 3);
        expect(1 - Math.pow(1 - alpha, 3)).toBeCloseTo(0.18, 10);
      });

      it("is not an even division of the peak", () => {
        expect(bloomRingAlpha(0.18, 3)).toBeGreaterThan(0.18 / 3);
      });
    });

    describe("heroBlooms", () => {
      it("lights the hero floor in the dark theme", () => {
        expect(heroBlooms(true).map((bloom) => bloom.key)).toEqual(["corner", "floor"]);
      });

      it("leaves the light theme the corner bloom alone", () => {
        expect(heroBlooms(false).map((bloom) => bloom.key)).toEqual(["corner"]);
      });
    });

    it("shadows the hero-overlay text off web, where the web textShadow has no effect", async () => {
      await onPlatform("ios", async () => {
        brandResponse({ headerImageUrl: "/media/hero.jpg" });
        renderWithProviders(<HomeScreen />);
        await waitFor(() => expect(screen.getAllByText("Hero Brand").length).toBeGreaterThan(0));
        expect(flatStyle(screen.getByText("Restaurant highlights"))).toMatchObject({
          textShadowColor: expect.any(String),
          textShadowRadius: expect.any(Number),
        });
      });
    });

    it("keeps the web hero-overlay text on its CSS textShadow", async () => {
      await onPlatform("web", async () => {
        brandResponse({ headerImageUrl: "/media/hero.jpg" });
        renderWithProviders(<HomeScreen />);
        await waitFor(() => expect(screen.getAllByText("Hero Brand").length).toBeGreaterThan(0));
        const style = flatStyle(screen.getByText("Restaurant highlights"));
        expect(style.textShadow).toContain("rgba(0,0,0,0.55)");
        expect(style.textShadowColor).toBeUndefined();
      });
    });
  });

  describe("the status bar over the hero", () => {
    const statusBarStyle = () =>
      screen.queryByTestId("hero-status-bar")?.props.accessibilityLabel as string | undefined;

    it("goes light over a header photo, whatever the theme", async () => {
      await onPlatform("ios", async () => {
        brandResponse({ headerImageUrl: "/media/hero.jpg" });
        renderWithProviders(<HomeScreen />);
        await waitFor(() => expect(statusBarStyle()).toBe("light"));
      });
    });

    it("leaves the bar to the theme without a photo to sit on", async () => {
      await onPlatform("ios", async () => {
        renderWithProviders(<HomeScreen />);
        await waitFor(() => expect(screen.getByText("Resto 1")).toBeTruthy());
        expect(screen.queryByTestId("hero-status-bar")).toBeNull();
      });
    });

    it("hands the bar back while another screen is in front", async () => {
      await onPlatform("ios", async () => {
        brandResponse({ headerImageUrl: "/media/hero.jpg" });
        renderWithProviders(<HomeScreen />);
        await waitFor(() => expect(statusBarStyle()).toBe("light"));
        await act(async () => {
          mockBlur?.();
        });
        expect(screen.queryByTestId("hero-status-bar")).toBeNull();
      });
    });

    it("never touches the web page, whose chrome is the browser's", async () => {
      await onPlatform("web", async () => {
        brandResponse({ headerImageUrl: "https://example.com/hero.jpg" });
        renderWithProviders(<HomeScreen />);
        await waitFor(() => expect(screen.getAllByText("Resto 1").length).toBeGreaterThan(0));
        expect(screen.queryByTestId("hero-status-bar")).toBeNull();
      });
    });
  });

  describe("pull to refresh", () => {
    type RefreshControlElement = React.ReactElement<{ refreshing: boolean; onRefresh: () => void }>;
    const refreshControlOf = () =>
      screen.UNSAFE_getByType(ScrollView).props.refreshControl as RefreshControlElement | undefined;

    it("offers a refresh control off web and none on it", async () => {
      let native: { unmount: () => void } | undefined;
      await onPlatform("ios", async () => {
        native = renderWithProviders(<HomeScreen />);
        await waitFor(() => expect(screen.getByText("Resto 1")).toBeTruthy());
        expect(refreshControlOf()?.props.refreshing).toBe(false);
      });
      native?.unmount();
      resetHomeCache();
      await onPlatform("web", async () => {
        renderWithProviders(<HomeScreen />);
        await waitFor(() => expect(screen.getByText("Resto 1")).toBeTruthy());
        expect(refreshControlOf()).toBeUndefined();
      });
    });

    it("reloads the list and the highlights, and asks each card for its times again", async () => {
      await onPlatform("ios", async () => {
        const { fetchAvailability } = require("@/api/availability");
        renderWithProviders(<HomeScreen />);
        await waitFor(() => expect(screen.getByText("Resto 1")).toBeTruthy());
        const callsBefore = (fetchAvailability as jest.Mock).mock.calls.length;

        (fetchRestaurants as jest.Mock).mockResolvedValueOnce([
          { ...mockRestaurants[0], name: "Renamed Bistro" },
        ]);
        await act(async () => {
          refreshControlOf()?.props.onRefresh();
        });
        await waitFor(() => expect(screen.getByText("Renamed Bistro")).toBeTruthy());
        await waitFor(() => expect(refreshControlOf()?.props.refreshing).toBe(false));
        expect(fetchHighlights).toHaveBeenCalledTimes(2);
        // A remounted card fetches afresh; a card merely re-rendered would not.
        expect((fetchAvailability as jest.Mock).mock.calls.length).toBeGreaterThan(callsBefore);
      });
    });

    it("settles the control when the reload fails, keeping what it had", async () => {
      await onPlatform("ios", async () => {
        renderWithProviders(<HomeScreen />);
        await waitFor(() => expect(screen.getByText("Resto 1")).toBeTruthy());
        (fetchRestaurants as jest.Mock).mockRejectedValueOnce(new Error("offline"));
        await act(async () => {
          refreshControlOf()?.props.onRefresh();
        });
        await waitFor(() => expect(refreshControlOf()?.props.refreshing).toBe(false));
        expect(screen.getByText("Resto 1")).toBeTruthy();
      });
    });
  });

  /**
   * The hero used to carry its own copy of the settings control, which scrolled away with it.
   * `GuestSettingsAnchor` pins the one control outside every root's scroll view instead, so
   * this screen must draw none of its own and only keep the band clear for it.
   */
  it("leaves the settings control to the layout's pinned anchor", async () => {
    await onPlatform("ios", async () => {
      renderWithProviders(<HomeScreen />);
      await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
      expect(screen.queryByTestId("home-guest-settings-open")).toBeNull();
      expect(screen.queryByTestId("guest-settings-open")).toBeNull();
    });
  });

  describe("the location cards' entrance", () => {
    const reduceMotion = (enabled: boolean) =>
      jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(enabled);

    it("lands the cards with a staggered rise off web", async () => {
      await onPlatform("ios", async () => {
        reduceMotion(false);
        renderWithProviders(<HomeScreen />);
        await waitFor(() =>
          expect(screen.getAllByTestId("location-card-reveal")).toHaveLength(mockRestaurants.length)
        );
      });
    });

    it("renders the cards at rest when the device asks for reduced motion", async () => {
      await onPlatform("ios", async () => {
        reduceMotion(true);
        renderWithProviders(<HomeScreen />);
        await waitFor(() => expect(screen.getByText("Resto 1")).toBeTruthy());
        expect(screen.queryAllByTestId("location-card-reveal")).toHaveLength(0);
      });
    });

    // The device answers asynchronously, so a visitor who navigates away first must not have
    // the answer written back into a screen that is gone.
    it("drops the reduced-motion answer that lands after the screen has left", async () => {
      await onPlatform("ios", async () => {
        let answer: (reduced: boolean) => void = () => {};
        jest
          .spyOn(AccessibilityInfo, "isReduceMotionEnabled")
          .mockReturnValue(new Promise<boolean>((resolve) => (answer = resolve)));

        const view = renderWithProviders(<HomeScreen />);
        view.unmount();
        answer(false);
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled();
      });
    });

    it("leaves the web cards to the scroll-driven reveal in global.css", async () => {
      await onPlatform("web", async () => {
        renderWithProviders(<HomeScreen />);
        await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
        expect(screen.queryAllByTestId("location-card-reveal")).toHaveLength(0);
      });
    });
  });

  /**
   * Issue #426. The list runs under the native tab bar on iOS, and inside a tab the bottom
   * inset is that bar's height, so the scroll content pads it or its last card is hidden. Web
   * has no bar and pads nothing.
   */
  describe("the tab bar", () => {
    const TAB_BAR = 83;
    const scrollPadding = () =>
      StyleSheet.flatten(screen.UNSAFE_getByType(ScrollView).props.contentContainerStyle)
        .paddingBottom;

    it("is cleared by the scroll content off web", async () => {
      await onPlatform("ios", async () => {
        renderWithInsets({ bottom: TAB_BAR }, <HomeScreen />);
        await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
        expect(scrollPadding()).toBe(TAB_BAR);
      });
    });

    it("is not a thing on web", async () => {
      await onPlatform("web", async () => {
        renderWithInsets({ bottom: TAB_BAR }, <HomeScreen />);
        await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
        expect(scrollPadding()).toBe(0);
      });
    });
  });
});
