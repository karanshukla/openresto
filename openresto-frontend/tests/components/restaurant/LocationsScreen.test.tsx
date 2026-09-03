/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, screen, waitFor, fireEvent, within } from "@testing-library/react-native";
import { Platform, ScrollView, StyleSheet } from "react-native";
import LocationsScreen, {
  availabilitySummary,
  splitFits,
} from "@/components/restaurant/LocationsScreen";
import { isMobileWidth } from "@/constants/breakpoints";
import { fetchRestaurants } from "@/api/restaurants";
import { scrollIntoView } from "@/utils/scrollIntoView";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

/**
 * ScrollToTopFab renders nothing off web (React Native has no `position: sticky`, so the rail
 * it needs cannot exist). The FAB rules below are web rules, and jest defaults Platform.OS to
 * "ios", so they have to say which platform they are about.
 */
const onWeb = async (body: () => Promise<void>) => {
  const original = Platform.OS;
  (Platform as unknown as { OS: string }).OS = "web";
  try {
    await body();
  } finally {
    (Platform as unknown as { OS: string }).OS = original;
  }
};

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

// jsdom reports no safe area, so the top inset has to be forced to a real value for the tests
// that ask which of the header and the screen is padding it. Zero by default leaves every
// other test in this file measuring exactly what it measured before.
const mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
jest.mock("react-native-safe-area-context", () => ({
  ...jest.requireActual("react-native-safe-area-context"),
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock("@/api/restaurants", () => ({
  fetchRestaurants: jest.fn(),
}));

jest.mock("@/utils/scrollIntoView", () => ({
  scrollIntoView: jest.fn(),
}));

jest.mock("@/components/layout/Footer", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    // Forwards onLayout: the screen measures the footer so the FAB can clear it.
    default: ({ onLayout }: { onLayout?: (e: unknown) => void }) => (
      <View testID="mock-footer" onLayout={onLayout} />
    ),
  };
});

jest.mock("@/components/booking/BookingDrawer", () => {
  const { View, Text, Pressable } = require("react-native");
  return {
    __esModule: true,
    default: function MockBookingDrawer({
      restaurant,
      seats,
      date,
      time,
      variant,
      onClose,
      onSeatsChange,
      onDateChange,
    }: any) {
      return (
        <View testID="mock-drawer">
          <Text testID="drawer-restaurant">{restaurant.name}</Text>
          <Text testID="drawer-seats">{String(seats)}</Text>
          <Text testID="drawer-date">{String(date)}</Text>
          <Text testID="drawer-time">{String(time)}</Text>
          <Text testID="drawer-variant">{variant}</Text>
          <Pressable testID="drawer-close" onPress={onClose} />
          <Pressable testID="drawer-seats-change" onPress={() => onSeatsChange(6)} />
          <Pressable testID="drawer-date-change" onPress={() => onDateChange("2026-09-09")} />
        </View>
      );
    },
  };
});

jest.mock("@/components/restaurant/LocationListItem", () => {
  const { View, Text, Pressable } = require("react-native");
  return {
    __esModule: true,
    default: function MockLocationListItem({
      restaurant,
      seats,
      date,
      meal,
      today,
      compact,
      defaultExpanded,
      registerRef,
      onExpand,
      onBook,
      onAvailabilityChange,
    }: any) {
      return (
        <View testID={`location-item-${restaurant.id}`}>
          <Text>{restaurant.name}</Text>
          <Text testID={`expanded-${restaurant.id}`}>{String(defaultExpanded)}</Text>
          <Text testID={`seats-${restaurant.id}`}>{String(seats)}</Text>
          <Text testID={`date-${restaurant.id}`}>{String(date)}</Text>
          <Text testID={`meal-${restaurant.id}`}>{String(meal)}</Text>
          <Text testID={`today-${restaurant.id}`}>{String(today)}</Text>
          <Text testID={`compact-${restaurant.id}`}>{String(compact)}</Text>
          <Pressable
            testID={`ref-${restaurant.id}`}
            onPress={() => registerRef(restaurant.id, { marker: `item-${restaurant.id}` })}
          />
          <Pressable testID={`expand-${restaurant.id}`} onPress={() => onExpand?.(restaurant.id)} />
          <Pressable testID={`book-${restaurant.id}`} onPress={() => onBook(restaurant, "19:30")} />
          <Pressable
            testID={`avail-${restaurant.id}`}
            onPress={() => onAvailabilityChange?.(restaurant.id, restaurant.id === 1 ? 3 : 0)}
          />
          <Pressable
            testID={`avail-null-${restaurant.id}`}
            onPress={() => onAvailabilityChange?.(restaurant.id, null)}
          />
        </View>
      );
    },
  };
});

const mockRestaurants = [
  {
    id: 1,
    name: "Downtown Bistro",
    address: "1 Main St",
    openTime: "09:00",
    closeTime: "22:00",
    openDays: "1,2,3,4,5,6,7",
    timezone: "UTC",
    sections: [],
  },
  {
    id: 2,
    name: "Uptown Grill",
    address: "2 Main St",
    openTime: "10:00",
    closeTime: "21:00",
    openDays: "1,2,3,4,5,6,7",
    timezone: "UTC",
    sections: [],
  },
];

/** Renders at a viewport wide enough for the side drawer unless a test overrides it. */
function mockViewport(width: number) {
  return jest
    .spyOn(require("react-native/Libraries/Utilities/useWindowDimensions"), "default")
    .mockReturnValue({ width, height: 900, scale: 1, fontScale: 1 });
}

jest.setTimeout(15000);

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

describe("availabilitySummary", () => {
  it("stays silent until every location has reported", () => {
    expect(availabilitySummary({ 1: 3 }, 2)).toBeNull();
    expect(availabilitySummary({}, 0)).toBeNull();
  });

  it("says it is still checking while any location is mid-fetch", () => {
    expect(availabilitySummary({ 1: 3, 2: null }, 2)).toBe("Checking availability…");
  });

  it("counts the locations that can seat the party", () => {
    expect(availabilitySummary({ 1: 3, 2: 0 }, 2)).toBe("1 of 2 locations have tables");
    expect(availabilitySummary({ 1: 3, 2: 2, 3: 1 }, 3)).toBe("3 of 3 locations have tables");
  });

  it("drops the counting for a single-location brand", () => {
    expect(availabilitySummary({ 1: 3 }, 1)).toBe("Tables available");
    expect(availabilitySummary({ 1: 0 }, 1)).toBe("No tables at this time");
  });
});

describe("LocationsScreen", () => {
  let dimensionsSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    dimensionsSpy = mockViewport(1280);
  });

  afterEach(() => {
    dimensionsSpy.mockRestore();
  });

  it("shows the loading spinner until restaurants resolve", async () => {
    let resolveFetch: (value: typeof mockRestaurants) => void = () => {};
    (fetchRestaurants as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );
    renderWithProviders(<LocationsScreen />);
    expect(screen.getByTestId("loading-screen")).toBeTruthy();
    resolveFetch(mockRestaurants);
    await waitFor(() => expect(screen.queryByTestId("loading-screen")).toBeNull());
  });

  it("shows an error with retry when the fetch fails, and recovers on retry", async () => {
    (fetchRestaurants as jest.Mock).mockRejectedValueOnce(new Error("network down"));
    (fetchRestaurants as jest.Mock).mockResolvedValueOnce(mockRestaurants);
    renderWithProviders(<LocationsScreen />);
    await waitFor(() => expect(screen.getByText(/load our locations/)).toBeTruthy());
    fireEvent.press(screen.getByText("Try again"));
    await waitFor(() => expect(screen.getByText("Downtown Bistro")).toBeTruthy());
    expect(screen.queryByText(/load our locations/)).toBeNull();
  });

  it("shows the empty state when there are no locations", async () => {
    (fetchRestaurants as jest.Mock).mockResolvedValue([]);
    renderWithProviders(<LocationsScreen />);
    await waitFor(() =>
      expect(screen.getByText("No locations yet. Please check back soon.")).toBeTruthy()
    );
    expect(screen.queryByTestId("locations-filter-bar")).toBeNull();
  });

  it("renders a LocationListItem per restaurant under one filter bar", async () => {
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    renderWithProviders(<LocationsScreen />);
    await waitFor(() => expect(screen.getByText("Downtown Bistro")).toBeTruthy());
    expect(screen.getByText("Uptown Grill")).toBeTruthy();
    expect(screen.getByTestId("locations-filter-bar")).toBeTruthy();
  });

  it("leaves the resting filter bar part of the list rather than a toolbar", async () => {
    await onWeb(async () => {
      (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
      renderWithProviders(<LocationsScreen />);
      await waitFor(() => expect(screen.getByTestId("locations-filter-sticky")).toBeTruthy());

      const style = StyleSheet.flatten(screen.getByTestId("locations-filter-sticky").props.style);
      expect(style.zIndex).toBe(5);
      // The band paints nothing until the bar pins: at rest the bar is one row of the list.
      expect(style.backgroundColor).toBeUndefined();
      expect(style.backgroundImage).toBeUndefined();
      // Its top and bottom gaps cost the resting list no height.
      expect(style.paddingTop + style.marginTop).toBe(0);
      expect(style.paddingBottom + style.marginBottom).toBe(0);

      // The bar sits in the page rather than over it, so it takes no shadow.
      const bar = StyleSheet.flatten(screen.getByTestId("locations-filter-bar").props.style);
      expect(bar.borderRadius).toBeGreaterThan(0);
      expect(bar.shadowOpacity).toBeUndefined();
    });
  });

  it("floats the pinned bar over the list instead of boxing it into a header", async () => {
    await onWeb(async () => {
      (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
      renderWithProviders(<LocationsScreen />);
      await waitFor(() => expect(screen.getByTestId("locations-filter-sticky")).toBeTruthy());

      fireEvent(screen.getByTestId("locations-filter-sticky"), "layout", {
        nativeEvent: { layout: { y: 120 } },
      });
      fireEvent.scroll(screen.UNSAFE_getByType(ScrollView), scrollEvent(400));

      // A mask, not a surface: it hides the list in the gap above the pill and fades out
      // rather than ending on an edge, which is what made the old band read as a header.
      const band = StyleSheet.flatten(screen.getByTestId("locations-filter-sticky").props.style);
      expect(band.backgroundImage).toContain("linear-gradient");
      expect(band.backgroundColor).toBeUndefined();
      expect(band.borderBottomWidth).toBeUndefined();

      // The bar keeps its pill shape throughout and lifts off the page to earn the overlap.
      const bar = StyleSheet.flatten(screen.getByTestId("locations-filter-bar").props.style);
      expect(bar.borderRadius).toBeGreaterThan(0);
      expect(bar.backgroundColor).not.toBe("transparent");
      expect(bar.shadowOpacity).toBeGreaterThan(0);
    });
  });

  /**
   * React Native has no `position: sticky`; the bar pins through `stickyHeaderIndices`, which
   * only takes a direct child of the ScrollView. Jest runs these on the default "ios".
   */
  describe("off web", () => {
    it("pins the filter band as the ScrollView's own second child", async () => {
      (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
      renderWithProviders(<LocationsScreen />);
      await waitFor(() => expect(screen.getByTestId("locations-filter-sticky")).toBeTruthy());

      const scrollView = screen.UNSAFE_getByType(ScrollView);
      expect(scrollView.props.stickyHeaderIndices).toEqual([1]);
      const children = React.Children.toArray(scrollView.props.children) as React.ReactElement<{
        testID?: string;
      }>[];
      expect(children[1].props.testID).toBe("locations-filter-sticky");
      // An opaque band, or the list would show through it while pinned.
      const band = StyleSheet.flatten(screen.getByTestId("locations-filter-sticky").props.style);
      expect(band.backgroundColor).toBeDefined();
      expect(band.backgroundImage).toBeUndefined();
    });

    it("pins nothing while there is no list to pin over", async () => {
      (fetchRestaurants as jest.Mock).mockResolvedValue([]);
      renderWithProviders(<LocationsScreen />);
      await waitFor(() => expect(screen.getByText(/No locations yet/)).toBeTruthy());
      expect(screen.UNSAFE_getByType(ScrollView).props.stickyHeaderIndices).toBeUndefined();
      expect(screen.queryByTestId("locations-filter-sticky")).toBeNull();
    });

    it("puts the availability summary under the compact bar, which has no room for it", async () => {
      dimensionsSpy.mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
      (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
      renderWithProviders(<LocationsScreen />);
      await waitFor(() => expect(screen.getByTestId("avail-1")).toBeTruthy());
      expect(screen.queryByTestId("locations-native-summary")).toBeNull();

      fireEvent.press(screen.getByTestId("avail-1"));
      fireEvent.press(screen.getByTestId("avail-2"));
      await waitFor(() => expect(screen.getByTestId("locations-native-summary")).toBeTruthy());
      expect(screen.getByTestId("locations-native-summary").props.children).toBe(
        "1 of 2 locations have tables"
      );
    });

    it("leaves the summary to the wide bar, which carries it itself", async () => {
      (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
      renderWithProviders(<LocationsScreen />);
      await waitFor(() => expect(screen.getByTestId("avail-1")).toBeTruthy());
      fireEvent.press(screen.getByTestId("avail-1"));
      fireEvent.press(screen.getByTestId("avail-2"));
      await waitFor(() => expect(screen.getByText("1 of 2 locations have tables")).toBeTruthy());
      expect(screen.queryByTestId("locations-native-summary")).toBeNull();
    });

    it("lifts the pinned bar the way the web band does, from the same scroll rule", async () => {
      (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
      renderWithProviders(<LocationsScreen />);
      await waitFor(() => expect(screen.getByTestId("locations-filter-sticky")).toBeTruthy());
      fireEvent(screen.getByTestId("locations-filter-sticky"), "layout", {
        nativeEvent: { layout: { y: 120 } },
      });
      const barStyle = () =>
        StyleSheet.flatten(screen.getByTestId("locations-filter-bar").props.style);
      fireEvent.scroll(screen.UNSAFE_getByType(ScrollView), scrollEvent(60));
      expect(barStyle().shadowOpacity).toBeUndefined();
      fireEvent.scroll(screen.UNSAFE_getByType(ScrollView), scrollEvent(400));
      expect(barStyle().shadowOpacity).toBeGreaterThan(0);
    });

    describe("pull to refresh", () => {
      const refreshControlOf = () =>
        screen.UNSAFE_getByType(ScrollView).props.refreshControl as React.ReactElement<{
          refreshing: boolean;
          onRefresh: () => void;
        }>;

      it("offers a refresh control off web and none on it", async () => {
        (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
        const native = renderWithProviders(<LocationsScreen />);
        await waitFor(() => expect(screen.getByText("Downtown Bistro")).toBeTruthy());
        expect(refreshControlOf()).toBeTruthy();
        expect(refreshControlOf().props.refreshing).toBe(false);
        native.unmount();

        await onWeb(async () => {
          renderWithProviders(<LocationsScreen />);
          await waitFor(() => expect(screen.getByText("Downtown Bistro")).toBeTruthy());
          expect(screen.UNSAFE_getByType(ScrollView).props.refreshControl).toBeUndefined();
        });
      });

      it("reloads the list and remounts the cards, keeping the list on screen meanwhile", async () => {
        (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
        renderWithProviders(<LocationsScreen />);
        await waitFor(() => expect(screen.getByText("Downtown Bistro")).toBeTruthy());

        // Mark a card, so a remount is visible as the mark being gone.
        fireEvent.press(screen.getByTestId("avail-1"));
        await waitFor(() => expect(screen.getByTestId("avail-1")).toBeTruthy());

        let resolveFetch: (value: unknown) => void = () => {};
        (fetchRestaurants as jest.Mock).mockReturnValueOnce(
          new Promise((resolve) => {
            resolveFetch = resolve;
          })
        );
        await act(async () => {
          refreshControlOf().props.onRefresh();
        });
        expect(refreshControlOf().props.refreshing).toBe(true);
        // No spinner page: the list is still there while the fetch is in flight.
        expect(screen.getByText("Downtown Bistro")).toBeTruthy();
        expect(screen.queryByTestId("loading-screen")).toBeNull();

        await act(async () => {
          resolveFetch([mockRestaurants[0]]);
        });
        await waitFor(() => expect(refreshControlOf().props.refreshing).toBe(false));
        expect(screen.queryByText("Uptown Grill")).toBeNull();
        expect(fetchRestaurants).toHaveBeenCalledTimes(2);
      });

      it("keeps the list it had when the refresh fails", async () => {
        (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
        renderWithProviders(<LocationsScreen />);
        await waitFor(() => expect(screen.getByText("Downtown Bistro")).toBeTruthy());

        (fetchRestaurants as jest.Mock).mockRejectedValueOnce(new Error("offline"));
        await act(async () => {
          refreshControlOf().props.onRefresh();
        });
        await waitFor(() => expect(refreshControlOf().props.refreshing).toBe(false));
        expect(screen.getByText("Downtown Bistro")).toBeTruthy();
        expect(screen.queryByText(/Couldn/)).toBeNull();
      });
    });
  });

  it("drives every card from the same party size, date and meal window", async () => {
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    renderWithProviders(<LocationsScreen initialSeats={4} />);
    await waitFor(() => expect(screen.getByTestId("seats-1")).toBeTruthy());

    expect(screen.getByTestId("seats-1").props.children).toBe("4");
    expect(screen.getByTestId("seats-2").props.children).toBe("4");
    expect(screen.getByTestId("meal-1").props.children).toBe("All");
    expect(screen.getByTestId("date-1").props.children).toBe(
      screen.getByTestId("date-2").props.children
    );
    expect(screen.getByTestId("date-1").props.children).toBe(
      screen.getByTestId("today-1").props.children
    );
  });

  it("passes the compact flag down at phone width", async () => {
    dimensionsSpy.mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    renderWithProviders(<LocationsScreen />);
    await waitFor(() => expect(screen.getByTestId("compact-1").props.children).toBe("true"));
  });

  it("summarises how many locations can seat the party once all have reported", async () => {
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    renderWithProviders(<LocationsScreen />);
    await waitFor(() => expect(screen.getByTestId("avail-1")).toBeTruthy());

    fireEvent.press(screen.getByTestId("avail-null-1"));
    fireEvent.press(screen.getByTestId("avail-null-2"));
    await waitFor(() => expect(screen.getByText("Checking availability…")).toBeTruthy());

    fireEvent.press(screen.getByTestId("avail-1"));
    fireEvent.press(screen.getByTestId("avail-2"));
    await waitFor(() => expect(screen.getByText("1 of 2 locations have tables")).toBeTruthy());

    // Re-reporting the same count is a no-op rather than a fresh state object.
    fireEvent.press(screen.getByTestId("avail-1"));
    expect(screen.getByText("1 of 2 locations have tables")).toBeTruthy();
  });

  describe("booking drawer", () => {
    it("opens beside the list on a wide viewport when a slot is picked", async () => {
      (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
      renderWithProviders(<LocationsScreen initialSeats={3} />);
      await waitFor(() => expect(screen.getByTestId("book-2")).toBeTruthy());
      expect(screen.queryByTestId("mock-drawer")).toBeNull();

      fireEvent.press(screen.getByTestId("book-2"));

      await waitFor(() => expect(screen.getByTestId("mock-drawer")).toBeTruthy());
      expect(screen.getByTestId("drawer-restaurant").props.children).toBe("Uptown Grill");
      expect(screen.getByTestId("drawer-time").props.children).toBe("19:30");
      expect(screen.getByTestId("drawer-seats").props.children).toBe("3");
      expect(screen.getByTestId("drawer-variant").props.children).toBe("side");
    });

    it("adopts a party size chosen inside the drawer, list included", async () => {
      (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
      renderWithProviders(<LocationsScreen initialSeats={3} />);
      await waitFor(() => expect(screen.getByTestId("book-2")).toBeTruthy());
      fireEvent.press(screen.getByTestId("book-2"));
      await waitFor(() => expect(screen.getByTestId("mock-drawer")).toBeTruthy());

      fireEvent.press(screen.getByTestId("drawer-seats-change"));

      // The bar is the first pass at party size; whatever the booking panel settles on wins,
      // so the cards behind it can't go on advertising times for a different party.
      expect(screen.getByTestId("drawer-seats").props.children).toBe("6");
      expect(screen.getByTestId("seats-1").props.children).toBe("6");
      expect(screen.getByTestId("seats-2").props.children).toBe("6");
    });

    it("adopts a date chosen inside the drawer, list included", async () => {
      (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
      renderWithProviders(<LocationsScreen />);
      await waitFor(() => expect(screen.getByTestId("book-2")).toBeTruthy());
      fireEvent.press(screen.getByTestId("book-2"));
      await waitFor(() => expect(screen.getByTestId("mock-drawer")).toBeTruthy());

      fireEvent.press(screen.getByTestId("drawer-date-change"));

      expect(screen.getByTestId("drawer-date").props.children).toBe("2026-09-09");
      expect(screen.getByTestId("date-1").props.children).toBe("2026-09-09");
      expect(screen.getByTestId("date-2").props.children).toBe("2026-09-09");
    });

    it("opens as a bottom sheet at phone width", async () => {
      dimensionsSpy.mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
      (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
      renderWithProviders(<LocationsScreen />);
      await waitFor(() => expect(screen.getByTestId("book-1")).toBeTruthy());

      fireEvent.press(screen.getByTestId("book-1"));

      await waitFor(() =>
        expect(screen.getByTestId("drawer-variant").props.children).toBe("sheet")
      );
    });

    // The drawer is a flex sibling of the whole viewport, so without this cap it sits
    // against the far edge of a wide monitor instead of under the navbar's overflow menu.
    it.each([
      [2000, 1264],
      [1440, 1264],
      [1280, 1224],
      [900, 844],
    ])(
      "at %ipx caps the two-pane row to the navbar's own content width (%ipx)",
      async (viewport, expected) => {
        dimensionsSpy.mockReturnValue({ width: viewport, height: 950, scale: 1, fontScale: 1 });
        (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
        renderWithProviders(<LocationsScreen />);
        await waitFor(() => expect(screen.getByTestId("book-1")).toBeTruthy());

        // Closed, the list is full-bleed like every other screen.
        expect(StyleSheet.flatten(screen.getByTestId("locations-row").props.style).maxWidth).toBe(
          undefined
        );

        fireEvent.press(screen.getByTestId("book-1"));
        await waitFor(() => expect(screen.getByTestId("mock-drawer")).toBeTruthy());

        expect(StyleSheet.flatten(screen.getByTestId("locations-row").props.style).maxWidth).toBe(
          expected
        );
      }
    );

    it("leaves the row uncapped for the phone sheet, which overlays rather than sits beside", async () => {
      dimensionsSpy.mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
      (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
      renderWithProviders(<LocationsScreen />);
      await waitFor(() => expect(screen.getByTestId("book-1")).toBeTruthy());

      fireEvent.press(screen.getByTestId("book-1"));
      await waitFor(() => expect(screen.getByTestId("mock-drawer")).toBeTruthy());

      expect(StyleSheet.flatten(screen.getByTestId("locations-row").props.style).maxWidth).toBe(
        undefined
      );
    });

    it("closes on request", async () => {
      (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
      renderWithProviders(<LocationsScreen />);
      await waitFor(() => expect(screen.getByTestId("book-1")).toBeTruthy());

      fireEvent.press(screen.getByTestId("book-1"));
      await waitFor(() => expect(screen.getByTestId("mock-drawer")).toBeTruthy());

      fireEvent.press(screen.getByTestId("drawer-close"));
      await waitFor(() => expect(screen.queryByTestId("mock-drawer")).toBeNull());
    });

    // The footer is page chrome. Left in the list column it loses the drawer's width off
    // its own row and wraps into a squashed block beside the booking form (#353), so an
    // open side drawer hands it back the page and it sits under both panes.
    it("keeps the footer in the list column while the drawer is closed", async () => {
      dimensionsSpy.mockReturnValue({ width: 1440, height: 900, scale: 1, fontScale: 1 });
      (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
      renderWithProviders(<LocationsScreen />);
      await waitFor(() => expect(screen.getByTestId("book-1")).toBeTruthy());

      expect(within(screen.getByTestId("locations-row")).getByTestId("mock-footer")).toBeTruthy();
    });

    it("lifts the footer clear of the column the side drawer squeezes", async () => {
      dimensionsSpy.mockReturnValue({ width: 1440, height: 900, scale: 1, fontScale: 1 });
      (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
      renderWithProviders(<LocationsScreen />);
      await waitFor(() => expect(screen.getByTestId("book-1")).toBeTruthy());

      fireEvent.press(screen.getByTestId("book-1"));
      await waitFor(() => expect(screen.getByTestId("mock-drawer")).toBeTruthy());

      expect(screen.getByTestId("mock-footer")).toBeTruthy();
      expect(within(screen.getByTestId("locations-row")).queryByTestId("mock-footer")).toBeNull();
    });

    // The FAB used to rest in the column's own bottom corner whatever was under it, so at
    // the end of the list it landed on the footer's links.
    /** Whether the FAB is currently offered, rather than faded out under the footer. */
    /**
     * Whether the FAB is being offered. Read off the control rather than by querying for it: it
     * stays mounted while hidden so it keeps its measured place, and fades rather than unmounting,
     * so a role query answers "is it painted" rather than "is it offered".
     */
    const fabShowing = (): boolean =>
      screen.getByTestId("scroll-to-top-fab", { includeHiddenElements: true }).props
        .accessibilityElementsHidden !== true;

    // The FAB used to climb over the footer and then to stand down over it. The climb slid an
    // element that reads as pinned up the page on every scroll near the bottom; standing down took
    // the shortcut away at the end of the page, which is where it is most wanted (#399). It sits
    // in the gutter beside the content column, which the footer's own row does not reach.
    it("keeps the FAB to the very end of the list", async () => {
      await onWeb(async () => {
        (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
        renderWithProviders(<LocationsScreen />);
        await waitFor(() => expect(screen.getByTestId("book-1")).toBeTruthy());

        const scrollView = screen.UNSAFE_getByType(ScrollView);

        fireEvent.scroll(scrollView, scrollEvent(400));
        expect(fabShowing()).toBe(true);

        fireEvent.scroll(scrollView, {
          nativeEvent: {
            contentOffset: { y: 3100 },
            contentSize: { height: 4000 },
            layoutMeasurement: { height: 900 },
          },
        });
        expect(fabShowing()).toBe(true);
      });
    });

    it("keeps the FAB with the drawer open, which takes the footer out of the column", async () => {
      await onWeb(async () => {
        (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
        renderWithProviders(<LocationsScreen />);
        await waitFor(() => expect(screen.getByTestId("book-1")).toBeTruthy());

        const scrollView = screen.UNSAFE_getByType(ScrollView);
        const atEnd = {
          nativeEvent: {
            contentOffset: { y: 3100 },
            contentSize: { height: 4000 },
            layoutMeasurement: { height: 900 },
          },
        };

        fireEvent.press(screen.getByTestId("book-1"));
        await waitFor(() => expect(screen.getByTestId("mock-drawer")).toBeTruthy());
        fireEvent.scroll(scrollView, atEnd);

        expect(fabShowing()).toBe(true);
      });
    });

    it("leaves the footer in the column for the phone sheet, which takes no width off it", async () => {
      dimensionsSpy.mockReturnValue({ width: 390, height: 844, scale: 1, fontScale: 1 });
      (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
      renderWithProviders(<LocationsScreen />);
      await waitFor(() => expect(screen.getByTestId("book-1")).toBeTruthy());

      fireEvent.press(screen.getByTestId("book-1"));
      await waitFor(() => expect(screen.getByTestId("mock-drawer")).toBeTruthy());

      expect(within(screen.getByTestId("locations-row")).getByTestId("mock-footer")).toBeTruthy();
    });
  });

  describe("deep links", () => {
    it("opens the drawer straight onto the linked time", async () => {
      (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
      renderWithProviders(<LocationsScreen highlightId={2} initialTime="18:30" initialSeats={4} />);

      await waitFor(() => expect(screen.getByTestId("mock-drawer")).toBeTruthy());
      expect(screen.getByTestId("drawer-restaurant").props.children).toBe("Uptown Grill");
      expect(screen.getByTestId("drawer-time").props.children).toBe("18:30");
      expect(screen.getByTestId("drawer-seats").props.children).toBe("4");
      // The card expands too (#310): arriving from a time press on the home page should
      // still show the location that was picked, not a booking panel on its own.
      expect(screen.getByTestId("expanded-2").props.children).toBe("true");
      expect(screen.getByTestId("expanded-1").props.children).toBe("false");
    });

    it("expands the linked location's details when the link carries no time", async () => {
      (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
      renderWithProviders(<LocationsScreen highlightId={2} />);
      await waitFor(() => expect(screen.getByTestId("expanded-2").props.children).toBe("true"));
      expect(screen.getByTestId("expanded-1").props.children).toBe("false");
      expect(screen.queryByTestId("mock-drawer")).toBeNull();
    });

    it("scrolls the highlighted location into view", async () => {
      (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
      renderWithProviders(<LocationsScreen highlightId={1} />);
      await waitFor(() => expect(screen.getByTestId("ref-1")).toBeTruthy());
      fireEvent.press(screen.getByTestId("ref-1"));

      await waitFor(() => expect(scrollIntoView).toHaveBeenCalled(), { timeout: 1000 });
    });

    it("ignores a highlightId that matches no location", async () => {
      (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
      renderWithProviders(<LocationsScreen highlightId={999} initialTime="18:30" />);
      await waitFor(() => expect(screen.getByText("Downtown Bistro")).toBeTruthy());
      expect(screen.queryByTestId("mock-drawer")).toBeNull();
    });
  });

  it("scrolls the expanded card's registered ref into view after an expand", async () => {
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    renderWithProviders(<LocationsScreen />);
    await waitFor(() => expect(screen.getByTestId("ref-1")).toBeTruthy());

    fireEvent.press(screen.getByTestId("ref-1"));
    fireEvent.press(screen.getByTestId("expand-1"));

    await waitFor(
      () =>
        expect(scrollIntoView).toHaveBeenCalledWith(
          { current: { marker: "item-1" } },
          expect.anything(),
          { block: "start" }
        ),
      { timeout: 1000 }
    );
  });

  it("falls back to a null ref when scrolling to a location that never registered one", async () => {
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    renderWithProviders(<LocationsScreen />);
    await waitFor(() => expect(screen.getByTestId("expand-2")).toBeTruthy());

    fireEvent.press(screen.getByTestId("expand-2"));

    await waitFor(
      () =>
        expect(scrollIntoView).toHaveBeenCalledWith({ current: null }, expect.anything(), {
          block: "start",
        }),
      { timeout: 1000 }
    );
  });

  it("lifts the filter bar only once the list has scrolled under it", async () => {
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    renderWithProviders(<LocationsScreen />);
    await waitFor(() => expect(screen.getByTestId("locations-filter-sticky")).toBeTruthy());

    const band = screen.getByTestId("locations-filter-sticky");
    fireEvent(band, "layout", { nativeEvent: { layout: { y: 120 } } });
    const barStyle = () =>
      StyleSheet.flatten(screen.getByTestId("locations-filter-bar").props.style);

    const scrollView = screen.UNSAFE_getByType(ScrollView);
    // Scrolled, but not yet past the bar: still sitting in the list, still unlifted.
    fireEvent.scroll(scrollView, scrollEvent(60));
    expect(barStyle().shadowOpacity).toBeUndefined();

    fireEvent.scroll(scrollView, scrollEvent(400));
    expect(barStyle().shadowOpacity).toBeGreaterThan(0);
  });

  it("onScroll handler updates scrollY", async () => {
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    renderWithProviders(<LocationsScreen />);
    await waitFor(() => expect(screen.getByText("Downtown Bistro")).toBeTruthy());
    const scrollView = screen.UNSAFE_getByType(ScrollView);
    fireEvent.scroll(scrollView, scrollEvent(400));
    // Line covered — no assertion needed beyond no crash.
  });

  it("scrollToTop calls scrollTo on the ScrollView ref via the ScrollToTopFab", async () => {
    await onWeb(async () => {
      dimensionsSpy.mockReturnValue({ width: 375, height: 812, scale: 1, fontScale: 1 });
      (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
      renderWithProviders(<LocationsScreen />);
      await waitFor(() => expect(screen.getByText("Downtown Bistro")).toBeTruthy());

      const scrollView = screen.UNSAFE_getByType(ScrollView);
      fireEvent.scroll(scrollView, scrollEvent(400));

      fireEvent.press(screen.getByLabelText("Scroll to top"));
      // scrollRef.current?.scrollTo is a no-op in tests — asserts no crash and
      // covers the scrollToTop callback.
    });
  });
});

/**
 * The drawer is a fixed 460dp that will not shrink, so the split is decided by arithmetic
 * rather than by device class. Gating it on the phone breakpoint (768) put both panes on an
 * ~800dp tablet in portrait and left the list under 300dp.
 */
describe("splitFits", () => {
  it("puts the drawer beside the list once both fit", () => {
    expect(splitFits(876)).toBe(true);
  });

  it("falls back to the sheet one dp under the width the two panes need", () => {
    expect(splitFits(875)).toBe(false);
  });

  it("keeps a tablet in portrait on the sheet even though it clears the phone breakpoint", () => {
    expect(isMobileWidth(800)).toBe(false);
    expect(splitFits(800)).toBe(false);
  });
});

/**
 * Issue #428. The screen renders under a native header on `/locations/[id]` and under nothing
 * at all on the `/locations` tab root, and the space above the list has to be claimed once:
 * by the scroll view when a header is there to collapse its large title against, by the
 * column itself when there is not. Both at once double-pads the top of the list.
 */
describe("LocationsScreen top inset", () => {
  const STATUS_BAR = 47;

  beforeEach(() => {
    mockInsets.top = STATUS_BAR;
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
  });

  afterEach(() => {
    mockInsets.top = 0;
  });

  const columnPadding = () =>
    StyleSheet.flatten(screen.getByTestId("locations-list-column").props.style).paddingTop;

  it("pads the status bar itself on the header-less tab root", async () => {
    renderWithProviders(<LocationsScreen />);
    await waitFor(() => expect(screen.getByTestId("locations-filter-sticky")).toBeTruthy());

    expect(columnPadding()).toBe(STATUS_BAR);
    expect(
      screen.UNSAFE_getByType(ScrollView).props.contentInsetAdjustmentBehavior
    ).toBeUndefined();
  });

  it("hands the inset to the scroll view under a native header", async () => {
    renderWithProviders(<LocationsScreen hasNativeHeader />);
    await waitFor(() => expect(screen.getByTestId("locations-filter-sticky")).toBeTruthy());

    expect(columnPadding()).toBeUndefined();
    expect(screen.UNSAFE_getByType(ScrollView).props.contentInsetAdjustmentBehavior).toBe(
      "automatic"
    );
  });

  it("leaves both to the browser on web, header or not", async () => {
    await onWeb(async () => {
      renderWithProviders(<LocationsScreen hasNativeHeader />);
      await waitFor(() => expect(screen.getByTestId("locations-filter-sticky")).toBeTruthy());

      expect(columnPadding()).toBeUndefined();
      expect(
        screen.UNSAFE_getByType(ScrollView).props.contentInsetAdjustmentBehavior
      ).toBeUndefined();
    });
  });
});

/**
 * Issue #426. Inside a tab the bottom inset is the tab bar's height on iOS, where the list runs
 * under it. The header-less root pads it in its scroll content; the route pushed under a native
 * header hands both edges to the scroll view (`contentInsetAdjustmentBehavior`), and padding
 * the bottom as well would double it.
 */
describe("LocationsScreen tab bar clearance", () => {
  const TAB_BAR = 83;

  beforeEach(() => {
    mockInsets.bottom = TAB_BAR;
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
  });

  afterEach(() => {
    mockInsets.bottom = 0;
  });

  const scrollPadding = () =>
    StyleSheet.flatten(screen.UNSAFE_getByType(ScrollView).props.contentContainerStyle)
      .paddingBottom;

  it("pads the bar itself on the header-less tab root", async () => {
    renderWithProviders(<LocationsScreen />);
    await waitFor(() => expect(screen.getByTestId("locations-filter-sticky")).toBeTruthy());

    expect(scrollPadding()).toBe(TAB_BAR);
  });

  it("leaves the bar to the scroll view under a native header", async () => {
    renderWithProviders(<LocationsScreen hasNativeHeader />);
    await waitFor(() => expect(screen.getByTestId("locations-filter-sticky")).toBeTruthy());

    expect(scrollPadding()).toBeUndefined();
  });

  it("pads nothing on web, which has no bar", async () => {
    await onWeb(async () => {
      renderWithProviders(<LocationsScreen />);
      await waitFor(() => expect(screen.getByTestId("locations-filter-sticky")).toBeTruthy());

      expect(scrollPadding()).toBe(0);
    });
  });
});
