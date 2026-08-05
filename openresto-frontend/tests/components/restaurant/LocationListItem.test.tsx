/**
 * @jest-environment jsdom
 *
 * Covers the booking-submission, walk-in branch, and menu-link behaviour that
 * moved out of the old standalone book/restaurant screens when they were
 * folded into the Locations list (issue #205).
 */
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react-native";
import { Platform } from "react-native";
import LocationListItem from "@/components/restaurant/LocationListItem";
import { createBooking } from "@/api/bookings";
import { fetchAvailability } from "@/api/availability";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";
import * as useAppThemeModule from "@/hooks/use-app-theme";
import { getThemeColors } from "@/theme/theme";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("expo-image", () => {
  const { View } = require("react-native");
  return {
    Image: ({ onError }: any) => <View testID="location-image" onError={onError} />,
  };
});

// Mock Modal so the booking-form-internal pickers render their children.
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  rn.Modal = ({ children, visible }: any) => (visible ? children : null);
  return rn;
});

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/api/availability", () => ({
  fetchAvailability: jest.fn().mockResolvedValue({ slots: [] }),
}));

jest.mock("@/api/bookings", () => ({
  createBooking: jest.fn(),
}));

jest.mock("@/components/booking/BookingForm", () => {
  const { Pressable, Text } = require("react-native");
  return function MockBookingForm({ onSubmit, onRefresh, initialTime }: any) {
    const baseData = {
      customerEmail: "test@example.com",
      customerName: "Test Guest",
      seats: 2,
      holdId: "hold_123",
      date: "2026-04-18",
      time: "15:00",
    };
    return (
      <>
        <Text testID="booking-form-initial-time">{String(initialTime)}</Text>
        <Pressable
          testID="submit-trigger"
          onPress={() => onSubmit({ ...baseData, tableId: 101, sectionId: 1 })}
        />
        <Pressable
          testID="submit-trigger-no-section"
          onPress={() => onSubmit({ ...baseData, tableId: 101, sectionId: null })}
        />
        <Pressable
          testID="submit-trigger-no-table"
          onPress={() => onSubmit({ ...baseData, tableId: null, sectionId: null })}
        />
        <Pressable
          testID="submit-trigger-unknown-table"
          onPress={() => onSubmit({ ...baseData, tableId: 9999, sectionId: null })}
        />
        <Pressable testID="refresh-trigger" onPress={() => onRefresh?.()} />
      </>
    );
  };
});

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

const registerRef = jest.fn();
const registerFormRef = jest.fn();
const onExpand = jest.fn();

jest.setTimeout(15000);

describe("LocationListItem", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createBooking as jest.Mock).mockResolvedValue({ id: 50, bookingRef: "REF123" });
  });

  it("renders the location name", async () => {
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByText("Toronto Resto")).toBeTruthy());
  });

  it("renders the inline booking form when expanded for a bookable location", async () => {
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByText("Toronto Resto")).toBeTruthy());
    // MockBookingForm renders when not walk-in only.
    expect(screen.getByTestId("submit-trigger")).toBeTruthy();
  });

  it("registers the form ref and triggers the deep-link scroll callback once expanded by default", async () => {
    const onScrollToForm = jest.fn();
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        defaultExpanded
        scrollToFormOnMount
        registerRef={registerRef}
        registerFormRef={registerFormRef}
        onExpand={onExpand}
        onScrollToForm={onScrollToForm}
      />
    );
    await waitFor(() => expect(screen.getByTestId("submit-trigger")).toBeTruthy());
    expect(registerFormRef).toHaveBeenCalledWith(mockRestaurant.id, expect.anything());
    expect(onScrollToForm).toHaveBeenCalledWith(mockRestaurant.id);
    expect(onScrollToForm).toHaveBeenCalledTimes(1);
  });

  it("navigates to the booking confirmation page on successful submission", async () => {
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByTestId("submit-trigger")).toBeTruthy());

    fireEvent.press(screen.getByTestId("submit-trigger"));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        "/booking-confirmation/REF123?email=test%40example.com"
      );
    });
  });

  it("shows a walk-in notice instead of the booking form for walk-in-only locations", async () => {
    renderWithProviders(
      <LocationListItem
        restaurant={{ ...mockRestaurant, walkInOnly: true } as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByTestId("walk-in-notice")).toBeTruthy());
    expect(screen.queryByTestId("submit-trigger")).toBeNull();
  });

  it("renders a View menu link when menuUrl is set and opens it on press", async () => {
    const { Linking } = require("react-native");
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);

    renderWithProviders(
      <LocationListItem
        restaurant={{ ...mockRestaurant, menuUrl: "https://example.com/menu.pdf" } as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByLabelText("View menu")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("View menu"));
    expect(openURLSpy).toHaveBeenCalledWith("https://example.com/menu.pdf");
    openURLSpy.mockRestore();
  });

  it("omits the View menu link when menuUrl is not set", async () => {
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByText("Toronto Resto")).toBeTruthy());
    expect(screen.queryByLabelText("View menu")).toBeNull();
  });

  it("parses the description blurb into a tappable inline link", async () => {
    const { Linking } = require("react-native");
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);

    renderWithProviders(
      <LocationListItem
        restaurant={
          {
            ...mockRestaurant,
            description: "Family-run since 1998. See our [menu](https://example.com/menu).",
          } as any
        }
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByText(/Family-run since 1998/)).toBeTruthy());
    expect(screen.getByText("menu")).toBeTruthy();
    fireEvent.press(screen.getByA11yHint("https://example.com/menu"));
    expect(openURLSpy).toHaveBeenCalledWith("https://example.com/menu");
    openURLSpy.mockRestore();
  });

  it("expands and collapses when the header is pressed, notifying onExpand only when expanding", async () => {
    const onExpandLocal = jest.fn();
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        registerRef={registerRef}
        onExpand={onExpandLocal}
      />
    );
    await waitFor(() => expect(screen.getByText("Toronto Resto")).toBeTruthy());
    expect(screen.queryByTestId("submit-trigger")).toBeNull();

    fireEvent.press(screen.getByText("Toronto Resto"));
    await waitFor(() => expect(screen.getByTestId("submit-trigger")).toBeTruthy());
    expect(onExpandLocal).toHaveBeenCalledWith(mockRestaurant.id);
    expect(onExpandLocal).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByText("Toronto Resto"));
    await waitFor(() => expect(screen.queryByTestId("submit-trigger")).toBeNull());
    // Collapsing doesn't notify onExpand again.
    expect(onExpandLocal).toHaveBeenCalledTimes(1);
  });

  it("view-details button scrolls the form into view when expanding, preferring onScrollToForm over onExpand", async () => {
    const onExpandLocal = jest.fn();
    const onScrollToForm = jest.fn();
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        registerRef={registerRef}
        onExpand={onExpandLocal}
        onScrollToForm={onScrollToForm}
      />
    );
    await waitFor(() => expect(screen.getByText("Book / details")).toBeTruthy());
    fireEvent.press(screen.getByText("Book / details"));
    await waitFor(() => expect(screen.getByTestId("submit-trigger")).toBeTruthy());
    expect(onScrollToForm).toHaveBeenCalledWith(mockRestaurant.id);
    expect(onExpandLocal).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Hide details"));
    await waitFor(() => expect(screen.queryByTestId("submit-trigger")).toBeNull());
    // Collapsing via this button doesn't re-trigger the scroll callback.
    expect(onScrollToForm).toHaveBeenCalledTimes(1);
  });

  it("view-details button falls back to onExpand when onScrollToForm is not provided", async () => {
    const onExpandLocal = jest.fn();
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        registerRef={registerRef}
        onExpand={onExpandLocal}
      />
    );
    await waitFor(() => expect(screen.getByText("Book / details")).toBeTruthy());
    fireEvent.press(screen.getByText("Book / details"));
    await waitFor(() => expect(screen.getByTestId("submit-trigger")).toBeTruthy());
    expect(onExpandLocal).toHaveBeenCalledWith(mockRestaurant.id);
  });

  it("renders tag chips when the restaurant has tags", async () => {
    renderWithProviders(
      <LocationListItem
        restaurant={{ ...mockRestaurant, tags: ["Vegan", "Patio"] } as any}
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByText("Vegan")).toBeTruthy());
    expect(screen.getByText("Patio")).toBeTruthy();
  });

  it("falls back away from the native image after it fails to load", async () => {
    renderWithProviders(
      <LocationListItem
        restaurant={{ ...mockRestaurant, imageUrl: "https://example.com/photo.jpg" } as any}
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByTestId("location-image")).toBeTruthy());
    fireEvent(screen.getByTestId("location-image"), "error");
    await waitFor(() => expect(screen.queryByTestId("location-image")).toBeNull());
  });

  it("opens Google Maps and Apple Maps links from the expanded address section", async () => {
    const { Linking } = require("react-native");
    const openURLSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined as never);
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByLabelText("Open in Google Maps")).toBeTruthy());
    fireEvent.press(screen.getByLabelText("Open in Google Maps"));
    expect(openURLSpy).toHaveBeenCalledWith(expect.stringContaining("https://maps.google.com/?q="));
    fireEvent.press(screen.getByLabelText("Open in Apple Maps"));
    expect(openURLSpy).toHaveBeenCalledWith(expect.stringContaining("https://maps.apple.com/?q="));
    openURLSpy.mockRestore();
  });

  it("calls the booking form's onRefresh handler without crashing", async () => {
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByTestId("refresh-trigger")).toBeTruthy());
    fireEvent.press(screen.getByTestId("refresh-trigger"));
  });

  it("resolves the owning section when the form submits an explicit table without a sectionId", async () => {
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByTestId("submit-trigger-no-section")).toBeTruthy());
    fireEvent.press(screen.getByTestId("submit-trigger-no-section"));
    await waitFor(() =>
      expect(createBooking).toHaveBeenCalledWith(
        expect.objectContaining({ sectionId: 1, tableId: 101 })
      )
    );
  });

  it("leaves sectionId null for an auto-assigned (any-table) booking", async () => {
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByTestId("submit-trigger-no-table")).toBeTruthy());
    fireEvent.press(screen.getByTestId("submit-trigger-no-table"));
    await waitFor(() =>
      expect(createBooking).toHaveBeenCalledWith(
        expect.objectContaining({ sectionId: null, tableId: null })
      )
    );
  });

  it("navigates using the booking id when the response has no bookingRef", async () => {
    (createBooking as jest.Mock).mockResolvedValue({ id: 77 });
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByTestId("submit-trigger")).toBeTruthy());
    fireEvent.press(screen.getByTestId("submit-trigger"));
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/booking-confirmation/77?email=test%40example.com")
    );
  });

  it("shows the thrown error message when booking submission fails", async () => {
    (createBooking as jest.Mock).mockRejectedValue(new Error("Table no longer available"));
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByTestId("submit-trigger")).toBeTruthy());
    fireEvent.press(screen.getByTestId("submit-trigger"));
    await waitFor(() => expect(screen.getByText("Table no longer available")).toBeTruthy());
  });

  it("shows a generic error message when a non-Error value is thrown", async () => {
    (createBooking as jest.Mock).mockRejectedValue("network down");
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByTestId("submit-trigger")).toBeTruthy());
    fireEvent.press(screen.getByTestId("submit-trigger"));
    await waitFor(() =>
      expect(screen.getByText("Something went wrong. Please try again.")).toBeTruthy()
    );
  });

  describe("slot preview filtering", () => {
    const utcRestaurant = { ...mockRestaurant, timezone: "UTC" };
    // Pins "now" to noon UTC (720 minutes, Thursday/isoDay 4) so slot times can be
    // asserted as deterministically past/future without relying on fake timers,
    // which hang this component's effects (real timers + a stubbed "now" instead).
    let nowSpy: jest.SpyInstance;

    beforeEach(() => {
      const restaurantTimeUtils = require("@/utils/restaurantTime");
      nowSpy = jest
        .spyOn(restaurantTimeUtils, "getRestaurantNow")
        .mockReturnValue({ totalMins: 720, isoDay: 4 });
    });

    afterEach(() => {
      nowSpy.mockRestore();
    });

    it("keeps only future, available slots and drops past or unavailable ones", async () => {
      (fetchAvailability as jest.Mock).mockResolvedValue({
        slots: [
          { time: "11:00", isAvailable: true },
          { time: "10:00", isAvailable: false },
          { time: "14:00", isAvailable: true },
        ],
      });
      renderWithProviders(
        <LocationListItem
          restaurant={utcRestaurant as any}
          registerRef={registerRef}
          onExpand={onExpand}
        />
      );
      await waitFor(() => expect(screen.getByText("14:00")).toBeTruthy());
      expect(screen.queryByText("11:00")).toBeNull();
      expect(screen.queryByText("10:00")).toBeNull();
    });

    it("shows no slots when the availability response has no usable slots array", async () => {
      (fetchAvailability as jest.Mock).mockResolvedValue(null);
      renderWithProviders(
        <LocationListItem
          restaurant={utcRestaurant as any}
          registerRef={registerRef}
          onExpand={onExpand}
        />
      );
      await waitFor(() => expect(screen.getByText("No available slots today")).toBeTruthy());
    });

    it("pressing a slot expands the card, seeds the booking form's initial time, and scrolls to the form", async () => {
      const onScrollToForm = jest.fn();
      (fetchAvailability as jest.Mock).mockResolvedValue({
        slots: [{ time: "14:00", isAvailable: true }],
      });
      renderWithProviders(
        <LocationListItem
          restaurant={utcRestaurant as any}
          registerRef={registerRef}
          onExpand={onExpand}
          onScrollToForm={onScrollToForm}
        />
      );
      await waitFor(() => expect(screen.getByText("14:00")).toBeTruthy());
      fireEvent.press(screen.getByText("14:00"));
      await waitFor(() => expect(screen.getByTestId("submit-trigger")).toBeTruthy());
      expect(screen.getByTestId("booking-form-initial-time").props.children).toBe("14:00");
      expect(onScrollToForm).toHaveBeenCalledWith(utcRestaurant.id);
    });

    it("pressing a slot without an onScrollToForm callback still expands without crashing", async () => {
      (fetchAvailability as jest.Mock).mockResolvedValue({
        slots: [{ time: "14:00", isAvailable: true }],
      });
      renderWithProviders(
        <LocationListItem
          restaurant={utcRestaurant as any}
          registerRef={registerRef}
          onExpand={onExpand}
        />
      );
      await waitFor(() => expect(screen.getByText("14:00")).toBeTruthy());
      fireEvent.press(screen.getByText("14:00"));
      await waitFor(() => expect(screen.getByTestId("submit-trigger")).toBeTruthy());
    });
  });

  it("falls back to the UTC timezone when the restaurant has none set", async () => {
    const { timezone: _timezone, ...noTimezoneRestaurant } = mockRestaurant;
    renderWithProviders(
      <LocationListItem
        restaurant={noTimezoneRestaurant as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByTestId("submit-trigger")).toBeTruthy());
    fireEvent.press(screen.getByTestId("submit-trigger"));
    await waitFor(() => expect(createBooking).toHaveBeenCalled());
  });

  it("applies dark-theme styling throughout the collapsed and expanded card", async () => {
    const spy = jest.spyOn(useAppThemeModule, "useAppTheme").mockReturnValue({
      colors: getThemeColors(true),
      isDark: true,
      primaryColor: "#0a7ea4",
    } as ReturnType<typeof useAppThemeModule.useAppTheme>);
    try {
      renderWithProviders(
        <LocationListItem
          restaurant={mockRestaurant as any}
          defaultExpanded
          registerRef={registerRef}
          onExpand={onExpand}
        />
      );
      await waitFor(() => expect(screen.getByText("Toronto Resto")).toBeTruthy());
    } finally {
      spy.mockRestore();
    }
  });

  it("view-details button expands without crashing when neither onExpand nor onScrollToForm is provided", async () => {
    renderWithProviders(
      <LocationListItem restaurant={mockRestaurant as any} registerRef={registerRef} />
    );
    await waitFor(() => expect(screen.getByText("Book / details")).toBeTruthy());
    fireEvent.press(screen.getByText("Book / details"));
    await waitFor(() => expect(screen.getByTestId("submit-trigger")).toBeTruthy());
  });

  it("falls back to no section when the submitted table isn't in any known section", async () => {
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByTestId("submit-trigger-unknown-table")).toBeTruthy());
    fireEvent.press(screen.getByTestId("submit-trigger-unknown-table"));
    await waitFor(() =>
      expect(createBooking).toHaveBeenCalledWith(
        expect.objectContaining({ sectionId: null, tableId: 9999 })
      )
    );
  });

  it("does nothing when the booking submission resolves with no booking at all", async () => {
    (createBooking as jest.Mock).mockResolvedValue(null);
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByTestId("submit-trigger")).toBeTruthy());
    fireEvent.press(screen.getByTestId("submit-trigger"));
    await waitFor(() => expect(createBooking).toHaveBeenCalled());
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByText("Something went wrong. Please try again.")).toBeNull();
  });

  it("shows a Closed today badge and hours row when the location has no open days configured", async () => {
    renderWithProviders(
      <LocationListItem
        restaurant={{ ...mockRestaurant, openDays: "" } as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getAllByText("Closed today").length).toBeGreaterThan(0));
  });

  it("omits the address row when the restaurant has no address", async () => {
    const { address: _address, ...noAddressRestaurant } = mockRestaurant;
    renderWithProviders(
      <LocationListItem
        restaurant={noAddressRestaurant as any}
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByText("Toronto Resto")).toBeTruthy());
    expect(screen.queryByLabelText("Open in Google Maps")).toBeNull();
  });

  describe("on web", () => {
    const originalPlatformOS = Platform.OS;

    beforeEach(() => {
      Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
    });

    afterEach(() => {
      Object.defineProperty(Platform, "OS", { value: originalPlatformOS, configurable: true });
    });

    it("renders the web background-image style when an imageUrl is set", async () => {
      renderWithProviders(
        <LocationListItem
          restaurant={{ ...mockRestaurant, imageUrl: "https://example.com/photo.jpg" } as any}
          registerRef={registerRef}
          onExpand={onExpand}
        />
      );
      await waitFor(() => expect(screen.getByText("Toronto Resto")).toBeTruthy());
    });

    it("renders the web gradient placeholder style when no imageUrl is set", async () => {
      renderWithProviders(
        <LocationListItem
          restaurant={mockRestaurant as any}
          registerRef={registerRef}
          onExpand={onExpand}
        />
      );
      await waitFor(() => expect(screen.getByText("Toronto Resto")).toBeTruthy());
    });
  });

  it("covers hover/press style states for the menu link, a slot chip, and both map links", async () => {
    (fetchAvailability as jest.Mock).mockResolvedValue({
      slots: [{ time: "23:30", isAvailable: true }],
    });
    renderWithProviders(
      <LocationListItem
        restaurant={{ ...mockRestaurant, menuUrl: "https://example.com/menu.pdf" } as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByLabelText("View menu")).toBeTruthy());
    await waitFor(() => expect(screen.getByLabelText("Open in Google Maps")).toBeTruthy());

    const findStyleFn = (label: string) => {
      let node = screen.getByLabelText(label).parent;
      while (node && typeof node.props?.style !== "function") {
        node = node.parent;
      }
      return node?.props.style as (state: { hovered: boolean; pressed: boolean }) => unknown;
    };

    for (const label of ["View menu", "Open in Google Maps", "Open in Apple Maps"]) {
      const styleFn = findStyleFn(label);
      expect(typeof styleFn).toBe("function");
      expect(styleFn({ hovered: true, pressed: false })).toBeTruthy();
      expect(styleFn({ hovered: false, pressed: false })).toBeTruthy();
    }

    let slotNode = screen.getByText("23:30").parent;
    while (slotNode && typeof slotNode.props?.style !== "function") {
      slotNode = slotNode.parent;
    }
    const slotStyleFn = slotNode?.props.style as (state: {
      hovered: boolean;
      pressed: boolean;
    }) => unknown;
    expect(typeof slotStyleFn).toBe("function");
    expect(slotStyleFn({ hovered: true, pressed: false })).toBeTruthy();
    expect(slotStyleFn({ hovered: false, pressed: false })).toBeTruthy();
  });

  it("uses singular 'guest' copy in the slot label when initialSeats is 1", async () => {
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        initialSeats={1}
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByText(/1 guest ·/)).toBeTruthy());
    expect(screen.queryByText(/1 guests ·/)).toBeNull();
  });

  it("labels today's hours as 'Today' rather than 'Open' when hours vary by day", async () => {
    const varyingHoursRestaurant = {
      ...mockRestaurant,
      openHours: [
        { day: 1, open: "09:00", close: "22:00" },
        { day: 2, open: "09:00", close: "22:00" },
        { day: 3, open: "09:00", close: "22:00" },
        { day: 4, open: "09:00", close: "22:00" },
        { day: 5, open: "09:00", close: "22:00" },
        { day: 6, open: "11:00", close: "23:00" },
        { day: 7, open: "11:00", close: "23:00" },
      ],
    };
    renderWithProviders(
      <LocationListItem
        restaurant={varyingHoursRestaurant as any}
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByText("Today ")).toBeTruthy());
  });

  it("falls back to a generic table label when a table has no name", async () => {
    const restaurantWithUnnamedTable = {
      ...mockRestaurant,
      sections: [
        {
          id: 1,
          name: "Main",
          restaurantId: 1,
          tables: [{ id: 202, name: undefined, seats: 2, sectionId: 1 }],
        },
      ],
    };
    renderWithProviders(
      <LocationListItem
        restaurant={restaurantWithUnnamedTable as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByText("Table 202")).toBeTruthy());
  });
  // ── Combinable table groups in the seating minimap (#271-#274) ──────────

  const restaurantWithGroups = {
    ...mockRestaurant,
    sections: [
      {
        id: 1,
        name: "Main",
        restaurantId: 1,
        tables: [
          { id: 101, name: "T1", seats: 4, sectionId: 1 },
          { id: 102, name: "T2", seats: 2, sectionId: 1 },
          { id: 103, name: "T3", seats: 2, sectionId: 1 },
        ],
      },
    ],
    groups: [
      {
        id: 1,
        name: "Window booths",
        combinedSeats: 5,
        members: [
          { id: 101, name: "T1", seats: 4 },
          { id: 102, name: "T2", seats: 2 },
        ],
      },
    ],
  };

  it("lists combinable groups with their combined capacity in the seating block", async () => {
    renderWithProviders(
      <LocationListItem
        restaurant={restaurantWithGroups as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByText("Tables we can combine")).toBeTruthy());
    expect(screen.getByText("Window booths")).toBeTruthy();
    expect(screen.getByText("Seats up to 5 pushed together")).toBeTruthy();
  });

  it("still lists member tables individually — grouping does not hide them (#242)", async () => {
    renderWithProviders(
      <LocationListItem
        restaurant={restaurantWithGroups as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByText("T1")).toBeTruthy());
    expect(screen.getByText("T2")).toBeTruthy();
    expect(screen.getByText("T3")).toBeTruthy();
  });

  it("names an unnamed group after its member tables", async () => {
    const unnamedGroup = {
      ...restaurantWithGroups,
      groups: [
        {
          id: 2,
          name: null,
          combinedSeats: 4,
          members: [
            { id: 102, name: "T2", seats: 2 },
            { id: 103, name: "T3", seats: 2 },
          ],
        },
      ],
    };
    renderWithProviders(
      <LocationListItem
        restaurant={unnamedGroup as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByText("Tables T2 + T3")).toBeTruthy());
  });

  it("omits the combinable block entirely for a location with no groups", async () => {
    renderWithProviders(
      <LocationListItem
        restaurant={mockRestaurant as any}
        defaultExpanded
        registerRef={registerRef}
        onExpand={onExpand}
      />
    );
    await waitFor(() => expect(screen.getByText("Seating & tables")).toBeTruthy());
    expect(screen.queryByText("Tables we can combine")).toBeNull();
  });
});
