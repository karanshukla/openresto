/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, waitFor, fireEvent, act } from "@testing-library/react-native";
import LookupScreen from "@/components/booking/LookupScreen";
import { getBookingByRef, getBookingById, cancelBookingByRef } from "@/api/bookings";
import { fetchRestaurantById } from "@/api/restaurants";
import { fetchCachedBookings } from "@/utils/bookingCache";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

jest.mock("@/components/layout/Footer", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View testID="mock-footer" /> };
});

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

// The sheet variant renders inside a Modal; render its children inline so tests can reach them.
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  rn.Modal = ({ children, visible }: any) => (visible ? children : null);
  return rn;
});

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  NotificationFeedbackType: { Success: "success", Error: "error" },
  ImpactFeedbackStyle: { Light: "light" },
}));

jest.mock("@/api/bookings", () => ({
  getBookingByRef: jest.fn(),
  getBookingById: jest.fn(),
  cancelBookingByRef: jest.fn(),
}));

jest.mock("@/api/restaurants", () => ({
  fetchRestaurantById: jest.fn(),
}));

jest.mock("@/utils/bookingCache", () => ({
  fetchCachedBookings: jest.fn(),
}));

jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

jest.mock("@/components/common/ConfirmModal", () => require("../../../jest-mocks/ConfirmModal"));

jest.setTimeout(15000);

const mockBooking = {
  id: 1,
  bookingRef: "REF123",
  customerEmail: "test@test.com",
  restaurantId: 1,
  date: "2026-10-10T12:00:00Z",
  seats: 2,
  isCancelled: false,
};

const mockRestaurant = { id: 1, name: "Test Resto", address: "123 Main St" };

function setWidth(width: number) {
  jest
    .spyOn(require("react-native"), "useWindowDimensions")
    .mockReturnValue({ width, height: 800 });
}

describe("LookupScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchCachedBookings as jest.Mock).mockResolvedValue([]);
    setWidth(1024);
  });

  it("renders the idle search form with no result panel", async () => {
    renderWithProviders(<LookupScreen />);
    expect(screen.getByText("Find my booking")).toBeTruthy();
    expect(screen.queryByTestId("result-panel")).toBeNull();
    await waitFor(() => expect(fetchCachedBookings).toHaveBeenCalled());
  });

  it("looks up a booking from the form and shows the result panel beside it", async () => {
    (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
    (fetchRestaurantById as jest.Mock).mockResolvedValue(mockRestaurant);
    renderWithProviders(<LookupScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
    fireEvent.changeText(
      screen.getByPlaceholderText("The email used when booking"),
      "test@test.com"
    );
    fireEvent.press(screen.getByText("Look Up"));

    await waitFor(() => expect(screen.getByText("Booking Found")).toBeTruthy());
    expect(screen.getByTestId("result-panel")).toBeTruthy();
    expect(screen.getByText("REF123")).toBeTruthy();
    expect(screen.getByText("Test Resto")).toBeTruthy();
    // The form stays put beside the panel — a second lookup costs no navigation.
    expect(screen.getByPlaceholderText("e.g. crispy-basil-thyme").props.value).toBe("REF123");
  });

  it("does not trigger a lookup when submitting the form with empty fields", async () => {
    renderWithProviders(<LookupScreen />);
    fireEvent(screen.getByPlaceholderText("The email used when booking"), "submitEditing");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getBookingByRef).not.toHaveBeenCalled();
  });

  it("shows a not-found card without a retry action", async () => {
    (getBookingByRef as jest.Mock).mockResolvedValue(null);
    renderWithProviders(<LookupScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "NOPE");
    fireEvent.changeText(
      screen.getByPlaceholderText("The email used when booking"),
      "test@test.com"
    );
    fireEvent.press(screen.getByText("Look Up"));

    await waitFor(() =>
      expect(screen.getByText("No booking found matching that reference and email.")).toBeTruthy()
    );
    expect(screen.queryByText("Try again")).toBeNull();
  });

  it("shows an error card, distinct from not-found, with a working retry", async () => {
    (getBookingByRef as jest.Mock)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(mockBooking);
    (fetchRestaurantById as jest.Mock).mockResolvedValue(mockRestaurant);
    renderWithProviders(<LookupScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
    fireEvent.changeText(
      screen.getByPlaceholderText("The email used when booking"),
      "test@test.com"
    );
    fireEvent.press(screen.getByText("Look Up"));

    await waitFor(() =>
      expect(
        screen.getByText("We couldn't reach the booking system. Your booking is safe.")
      ).toBeTruthy()
    );
    expect(screen.queryByText("No booking found matching that reference and email.")).toBeNull();

    fireEvent.press(screen.getByText("Try again"));
    await waitFor(() => expect(screen.getByText("Booking Found")).toBeTruthy());
    expect(getBookingByRef).toHaveBeenCalledTimes(2);
  });

  describe("deep links", () => {
    it("does nothing when only a ref is provided, with no email and no justBooked", async () => {
      renderWithProviders(<LookupScreen initialRef="REF123" />);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getBookingByRef).not.toHaveBeenCalled();
      expect(screen.queryByTestId("result-panel")).toBeNull();
    });

    it("runs the lookup on mount for a ref+email deep link and prefills the form", async () => {
      (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
      (fetchRestaurantById as jest.Mock).mockResolvedValue(mockRestaurant);
      renderWithProviders(<LookupScreen initialRef="REF123" initialEmail="test@test.com" />);

      await waitFor(() => expect(screen.getByText("Booking Found")).toBeTruthy());
      expect(getBookingByRef).toHaveBeenCalledWith("REF123", "test@test.com");
      expect(screen.getByPlaceholderText("e.g. crispy-basil-thyme").props.value).toBe("REF123");
    });

    it("justBooked proceeds even without an email, and shows Booking Confirmed", async () => {
      (getBookingByRef as jest.Mock).mockResolvedValue(null);
      (getBookingById as jest.Mock).mockResolvedValue(mockBooking);
      renderWithProviders(<LookupScreen initialRef="50" legacyBookingId={50} justBooked />);

      await waitFor(() => expect(screen.getByText("Booking Confirmed")).toBeTruthy());
      expect(getBookingByRef).not.toHaveBeenCalled();
      expect(getBookingById).toHaveBeenCalledWith(50);
    });

    it("fires success haptics once a justBooked deep link resolves to an active booking", async () => {
      const Haptics = require("expo-haptics");
      (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
      renderWithProviders(
        <LookupScreen initialRef="REF123" initialEmail="test@test.com" justBooked />
      );

      await waitFor(() => expect(screen.getByText("Booking Confirmed")).toBeTruthy());
      await waitFor(() => expect(Haptics.notificationAsync).toHaveBeenCalledWith("success"));
    });

    it("fires error-tone haptics when the justBooked booking is already cancelled", async () => {
      const Haptics = require("expo-haptics");
      (getBookingByRef as jest.Mock).mockResolvedValue({ ...mockBooking, isCancelled: true });
      renderWithProviders(
        <LookupScreen initialRef="REF123" initialEmail="test@test.com" justBooked />
      );

      await waitFor(() => expect(screen.getByText("Booking Cancelled")).toBeTruthy());
      await waitFor(() => expect(Haptics.notificationAsync).toHaveBeenCalledWith("error"));
    });

    it("does not fire haptics for a plain (non-justBooked) deep link", async () => {
      const Haptics = require("expo-haptics");
      (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
      renderWithProviders(<LookupScreen initialRef="REF123" initialEmail="test@test.com" />);
      await waitFor(() => expect(screen.getByText("Booking Found")).toBeTruthy());
      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    });
  });

  describe("recent bookings", () => {
    it("renders cached bookings and triggers a lookup on press", async () => {
      const mockCached = [
        {
          bookingRef: "CACHED1",
          email: "cached@test.com",
          restaurantName: "Cached Resto",
          date: "2026-01-01",
          seats: 4,
        },
      ];
      (fetchCachedBookings as jest.Mock).mockResolvedValue(mockCached);
      (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);

      renderWithProviders(<LookupScreen />);

      await waitFor(() => expect(screen.getByText("YOUR RECENT BOOKINGS")).toBeTruthy());
      fireEvent.press(screen.getByText("CACHED1"));

      expect(getBookingByRef).toHaveBeenCalledWith("CACHED1", "cached@test.com");
      await waitFor(() =>
        expect(screen.getByPlaceholderText("e.g. crispy-basil-thyme").props.value).toBe("CACHED1")
      );
    });

    it("keeps the recent-bookings list up while a result is showing, marking the open one", async () => {
      const mockCached = [
        {
          bookingRef: "REF123",
          email: "test@test.com",
          restaurantName: "Cached Resto",
          date: "2026-01-01",
          seats: 4,
        },
        {
          bookingRef: "OTHER9",
          email: "test@test.com",
          restaurantName: "Other Resto",
          date: "2026-02-02",
          seats: 2,
        },
      ];
      (fetchCachedBookings as jest.Mock).mockResolvedValue(mockCached);
      (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);

      renderWithProviders(<LookupScreen />);
      await waitFor(() => expect(screen.getByText("YOUR RECENT BOOKINGS")).toBeTruthy());

      fireEvent.press(screen.getByText("REF123"));

      await waitFor(() => expect(screen.getByText("Booking Found")).toBeTruthy());
      // The list stays put — the panel is a column over, not on top of it — so the diner
      // can go straight to another booking without dismissing the result first.
      expect(screen.getByText("YOUR RECENT BOOKINGS")).toBeTruthy();
      expect(screen.getByText("OTHER9")).toBeTruthy();

      const openRow = screen.getByLabelText("Look up booking REF123 at Cached Resto");
      expect(openRow.props.accessibilityState).toEqual({ selected: true });
      const otherRow = screen.getByLabelText("Look up booking OTHER9 at Other Resto");
      expect(otherRow.props.accessibilityState).toEqual({ selected: false });
    });
  });

  describe("cancelling", () => {
    beforeEach(() => {
      (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
    });

    async function lookUpABooking() {
      renderWithProviders(<LookupScreen />);
      fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
      fireEvent.changeText(
        screen.getByPlaceholderText("The email used when booking"),
        "test@test.com"
      );
      fireEvent.press(screen.getByText("Look Up"));
      await waitFor(() => expect(screen.getByText("Cancel This Booking")).toBeTruthy());
    }

    it("cancels the booking and updates the panel in place", async () => {
      (cancelBookingByRef as jest.Mock).mockResolvedValue(true);
      await lookUpABooking();

      fireEvent.press(screen.getByText("Cancel This Booking"));
      expect(await screen.findByTestId("confirm-modal")).toBeTruthy();
      fireEvent.press(screen.getByText("Cancel Booking"));

      await waitFor(() => expect(screen.getByText("Booking Cancelled")).toBeTruthy());
      expect(screen.queryByText("Cancel This Booking")).toBeNull();
      // Optimistic update, not a second network round trip.
      expect(getBookingByRef).toHaveBeenCalledTimes(1);
    });

    it("dismissing the confirm modal does not cancel the booking", async () => {
      await lookUpABooking();
      fireEvent.press(screen.getByText("Cancel This Booking"));
      expect(await screen.findByTestId("confirm-modal")).toBeTruthy();
      fireEvent.press(screen.getByText("Keep Booking"));
      await waitFor(() => expect(screen.queryByTestId("confirm-modal")).toBeNull());
      expect(cancelBookingByRef).not.toHaveBeenCalled();
      expect(screen.getByText("Cancel This Booking")).toBeTruthy();
    });

    it("shows an alert modal when cancellation fails", async () => {
      (cancelBookingByRef as jest.Mock).mockRejectedValue(new Error("Failed to cancel booking."));
      await lookUpABooking();

      fireEvent.press(screen.getByText("Cancel This Booking"));
      fireEvent.press(await screen.findByText("Cancel Booking"));

      await waitFor(() => expect(screen.getByText("Failed to cancel booking.")).toBeTruthy());
      expect(screen.getByText("Cancel This Booking")).toBeTruthy();
    });
  });

  describe("compact layout", () => {
    beforeEach(() => setWidth(400));

    it("shows the result as a bottom sheet instead of a side panel", async () => {
      (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
      (fetchRestaurantById as jest.Mock).mockResolvedValue(mockRestaurant);
      renderWithProviders(<LookupScreen />);

      fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
      fireEvent.changeText(
        screen.getByPlaceholderText("The email used when booking"),
        "test@test.com"
      );
      fireEvent.press(screen.getByText("Look Up"));

      await waitFor(() => expect(screen.getByText("Booking Found")).toBeTruthy());
      expect(
        screen.getByTestId("result-panel-grabber", { includeHiddenElements: true })
      ).toBeTruthy();
    });

    it("dismissing the sheet lands back on the idle form", async () => {
      (getBookingByRef as jest.Mock).mockResolvedValue(mockBooking);
      (fetchRestaurantById as jest.Mock).mockResolvedValue(mockRestaurant);
      renderWithProviders(<LookupScreen />);

      fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
      fireEvent.changeText(
        screen.getByPlaceholderText("The email used when booking"),
        "test@test.com"
      );
      fireEvent.press(screen.getByText("Look Up"));
      await waitFor(() => expect(screen.getByText("Booking Found")).toBeTruthy());

      fireEvent.press(screen.getByTestId("result-panel-backdrop", { includeHiddenElements: true }));

      // The dismiss animation runs on a real 180ms timer; act() flushes the state update
      // its completion callback fires once that real time has actually passed.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 400));
      });
      expect(screen.queryByTestId("result-panel")).toBeNull();
      expect(screen.getByText("Find my booking")).toBeTruthy();
    });
  });

  it("shows a loading skeleton in the panel column while a lookup is in flight", async () => {
    let resolveLookup: (v: unknown) => void = () => {};
    (getBookingByRef as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveLookup = resolve;
      })
    );
    renderWithProviders(<LookupScreen />);

    fireEvent.changeText(screen.getByPlaceholderText("e.g. crispy-basil-thyme"), "REF123");
    fireEvent.changeText(
      screen.getByPlaceholderText("The email used when booking"),
      "test@test.com"
    );
    fireEvent.press(screen.getByText("Look Up"));

    await waitFor(() => expect(screen.getByLabelText("Loading booking")).toBeTruthy());
    resolveLookup(mockBooking);
    await waitFor(() => expect(screen.getByText("Booking Found")).toBeTruthy());
  });

  it("fires onScroll to track scrollY for the scroll-to-top FAB", () => {
    renderWithProviders(<LookupScreen />);
    const { ScrollView } = require("react-native");
    const scrollViews = screen.UNSAFE_getAllByType(ScrollView);
    fireEvent.scroll(scrollViews[0], { nativeEvent: { contentOffset: { y: 400 } } });
    expect(screen.getByText("Find my booking")).toBeTruthy();
  });
});
