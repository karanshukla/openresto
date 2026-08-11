/**
 * @jest-environment jsdom
 *
 * Covers the booking submission that moved out of the Locations card when booking became
 * a drawer beside the list rather than an accordion body inside it.
 */
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import BookingDrawer, { shouldDismissSheet } from "@/components/booking/BookingDrawer";
import { createBooking } from "@/api/bookings";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

// The sheet variant renders inside a Modal; render its children inline so tests can reach them.
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  rn.Modal = ({ children, visible }: any) => (visible ? children : null);
  return rn;
});

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/api/bookings", () => ({
  createBooking: jest.fn(),
}));

jest.mock("@/components/booking/BookingForm", () => {
  const { Pressable, Text } = require("react-native");
  return {
    __esModule: true,
    default: function MockBookingForm({
      onSubmit,
      onSeatsChange,
      onDateChange,
      layout,
      seats,
      date,
      initialTime,
    }: any) {
      const baseData = {
        customerEmail: "test@example.com",
        customerName: "Test Guest",
        seats,
        holdId: "hold_123",
        date,
        time: initialTime,
        specialRequests: "",
      };
      return (
        <>
          <Text testID="form-layout">{layout}</Text>
          <Text testID="form-seats">{String(seats)}</Text>
          <Text testID="form-date">{String(date)}</Text>
          <Text testID="form-initial-time">{String(initialTime)}</Text>
          <Pressable testID="form-seats-change" onPress={() => onSeatsChange(6)} />
          <Pressable testID="form-date-change" onPress={() => onDateChange("2026-04-18")} />
          <Pressable
            testID="submit-trigger"
            onPress={() =>
              onSubmit({ ...baseData, tableId: 101, sectionId: 1, tableGroupId: null })
            }
          />
          <Pressable
            testID="submit-trigger-no-section"
            onPress={() =>
              onSubmit({ ...baseData, tableId: 101, sectionId: null, tableGroupId: null })
            }
          />
          <Pressable
            testID="submit-trigger-no-table"
            onPress={() =>
              onSubmit({ ...baseData, tableId: null, sectionId: null, tableGroupId: null })
            }
          />
          <Pressable
            testID="submit-trigger-unknown-table"
            onPress={() =>
              onSubmit({ ...baseData, tableId: 9999, sectionId: null, tableGroupId: null })
            }
          />
          <Pressable
            testID="submit-trigger-with-requests"
            onPress={() =>
              onSubmit({
                ...baseData,
                tableId: null,
                sectionId: null,
                tableGroupId: null,
                specialRequests: "Nut allergy",
              })
            }
          />
        </>
      );
    },
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

const TODAY = "2026-04-16";

const baseProps = {
  restaurant: mockRestaurant as any,
  seats: 2,
  date: TODAY,
  time: "19:30",
  today: TODAY,
  variant: "side" as const,
  onClose: jest.fn(),
  onSeatsChange: jest.fn(),
  onDateChange: jest.fn(),
};

describe("BookingDrawer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (createBooking as jest.Mock).mockResolvedValue({ id: 50, bookingRef: "REF123" });
  });

  it("heads the panel with the location and the criteria already chosen", () => {
    renderWithProviders(<BookingDrawer {...baseProps} />);
    expect(screen.getByText("Toronto Resto")).toBeTruthy();
    expect(screen.getByText("2 guests · Today · 19:30")).toBeTruthy();
  });

  it("names the day when booking a date other than today", () => {
    renderWithProviders(<BookingDrawer {...baseProps} date="2026-04-17" />);
    expect(screen.getByText(/^2 guests · Fri, Apr 17 · 19:30$/)).toBeTruthy();
  });

  it("uses singular 'guest' copy for a party of one", () => {
    renderWithProviders(<BookingDrawer {...baseProps} seats={1} />);
    expect(screen.getByText("1 guest · Today · 19:30")).toBeTruthy();
  });

  it("hands the already-chosen party, date and time to the form in drawer layout", () => {
    renderWithProviders(<BookingDrawer {...baseProps} seats={5} />);
    expect(screen.getByTestId("form-layout").props.children).toBe("drawer");
    expect(screen.getByTestId("form-seats").props.children).toBe("5");
    expect(screen.getByTestId("form-date").props.children).toBe(TODAY);
    expect(screen.getByTestId("form-initial-time").props.children).toBe("19:30");
  });

  it("passes a party-size change up to the page so the list behind it follows", () => {
    const onSeatsChange = jest.fn();
    renderWithProviders(<BookingDrawer {...baseProps} onSeatsChange={onSeatsChange} />);
    fireEvent.press(screen.getByTestId("form-seats-change"));
    expect(onSeatsChange).toHaveBeenCalledWith(6);
  });

  it("passes a date change up to the page the same way", () => {
    const onDateChange = jest.fn();
    renderWithProviders(<BookingDrawer {...baseProps} onDateChange={onDateChange} />);
    fireEvent.press(screen.getByTestId("form-date-change"));
    expect(onDateChange).toHaveBeenCalledWith("2026-04-18");
  });

  it("floats as a rounded card rather than a column welded to the page edge", () => {
    renderWithProviders(<BookingDrawer {...baseProps} />);
    const panel = StyleSheet.flatten(screen.getByTestId("booking-drawer").props.style);
    expect(panel.borderRadius).toBeGreaterThan(0);
    // All four sides, not the single left edge a docked column would carry.
    expect(panel.borderWidth).toBe(1);
    expect(panel.borderLeftWidth).toBeUndefined();
    expect(panel.marginTop).toBeGreaterThan(0);
    expect(panel.marginBottom).toBeGreaterThan(0);
    expect(panel.marginLeft).toBeGreaterThan(0);
    // Corners are only round if the header fill and the scroll body are clipped to them.
    expect(panel.overflow).toBe("hidden");
  });

  it("closes on the close button", () => {
    const onClose = jest.fn();
    renderWithProviders(<BookingDrawer {...baseProps} onClose={onClose} />);
    fireEvent.press(screen.getByTestId("booking-drawer-close"));
    expect(onClose).toHaveBeenCalled();
  });

  describe("as a bottom sheet", () => {
    it("renders inside the sheet shell", () => {
      renderWithProviders(<BookingDrawer {...baseProps} variant="sheet" />);
      expect(screen.getByTestId("booking-drawer")).toBeTruthy();
      expect(screen.getByText("Toronto Resto")).toBeTruthy();
    });

    it("keeps the sheet flush to the bottom edge, rounded only at the top", () => {
      renderWithProviders(<BookingDrawer {...baseProps} variant="sheet" />);
      const sheet = StyleSheet.flatten(screen.getByTestId("booking-drawer").props.style);
      // The side panel's float treatment must not leak here: a sheet that floats above
      // the bottom edge of a phone leaves a strip of page under it.
      expect(sheet.borderTopLeftRadius).toBeGreaterThan(0);
      expect(sheet.borderRadius).toBeUndefined();
      expect(sheet.marginBottom).toBeUndefined();
    });

    it("offers a drag handle wired to the pan responder", () => {
      renderWithProviders(<BookingDrawer {...baseProps} variant="sheet" />);
      const grabber = screen.getByTestId("booking-drawer-grabber");
      // PanResponder spreads its handlers onto the view it is attached to; without them
      // the handle is decorative and the sheet cannot be dragged away.
      expect(grabber.props.onStartShouldSetResponder).toBeDefined();
      expect(grabber.props.onMoveShouldSetResponder).toBeDefined();
    });

    it("closes when the backdrop is tapped", () => {
      const onClose = jest.fn();
      renderWithProviders(<BookingDrawer {...baseProps} variant="sheet" onClose={onClose} />);
      fireEvent.press(screen.getByTestId("booking-drawer-backdrop"));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("submission", () => {
    it("navigates to the booking confirmation page on success", async () => {
      renderWithProviders(<BookingDrawer {...baseProps} />);
      fireEvent.press(screen.getByTestId("submit-trigger"));
      await waitFor(() =>
        expect(mockPush).toHaveBeenCalledWith(
          "/booking-confirmation/REF123?email=test%40example.com"
        )
      );
    });

    it("navigates using the booking id when the response has no bookingRef", async () => {
      (createBooking as jest.Mock).mockResolvedValue({ id: 77 });
      renderWithProviders(<BookingDrawer {...baseProps} />);
      fireEvent.press(screen.getByTestId("submit-trigger"));
      await waitFor(() =>
        expect(mockPush).toHaveBeenCalledWith("/booking-confirmation/77?email=test%40example.com")
      );
    });

    it("resolves the owning section for an explicit table submitted without one", async () => {
      renderWithProviders(<BookingDrawer {...baseProps} />);
      fireEvent.press(screen.getByTestId("submit-trigger-no-section"));
      await waitFor(() =>
        expect(createBooking).toHaveBeenCalledWith(
          expect.objectContaining({ sectionId: 1, tableId: 101 })
        )
      );
    });

    it("falls back to no section when the submitted table isn't in any known section", async () => {
      renderWithProviders(<BookingDrawer {...baseProps} />);
      fireEvent.press(screen.getByTestId("submit-trigger-unknown-table"));
      await waitFor(() =>
        expect(createBooking).toHaveBeenCalledWith(
          expect.objectContaining({ sectionId: null, tableId: 9999 })
        )
      );
    });

    it("leaves sectionId null for an auto-assigned (any-table) booking", async () => {
      renderWithProviders(<BookingDrawer {...baseProps} />);
      fireEvent.press(screen.getByTestId("submit-trigger-no-table"));
      await waitFor(() =>
        expect(createBooking).toHaveBeenCalledWith(
          expect.objectContaining({ sectionId: null, tableId: null })
        )
      );
    });

    it("sends special requests through, and null when there are none", async () => {
      renderWithProviders(<BookingDrawer {...baseProps} />);
      fireEvent.press(screen.getByTestId("submit-trigger-with-requests"));
      await waitFor(() =>
        expect(createBooking).toHaveBeenCalledWith(
          expect.objectContaining({ specialRequests: "Nut allergy" })
        )
      );

      fireEvent.press(screen.getByTestId("submit-trigger-no-table"));
      await waitFor(() =>
        expect(createBooking).toHaveBeenCalledWith(
          expect.objectContaining({ specialRequests: null })
        )
      );
    });

    it("falls back to the UTC timezone when the restaurant has none set", async () => {
      const { timezone: _timezone, ...noTimezone } = mockRestaurant;
      renderWithProviders(<BookingDrawer {...baseProps} restaurant={noTimezone as any} />);
      fireEvent.press(screen.getByTestId("submit-trigger"));
      await waitFor(() => expect(createBooking).toHaveBeenCalled());
    });

    it("shows the thrown error message when submission fails", async () => {
      (createBooking as jest.Mock).mockRejectedValue(new Error("Table no longer available"));
      renderWithProviders(<BookingDrawer {...baseProps} />);
      fireEvent.press(screen.getByTestId("submit-trigger"));
      await waitFor(() => expect(screen.getByText("Table no longer available")).toBeTruthy());
    });

    it("shows a generic error message when a non-Error value is thrown", async () => {
      (createBooking as jest.Mock).mockRejectedValue("network down");
      renderWithProviders(<BookingDrawer {...baseProps} />);
      fireEvent.press(screen.getByTestId("submit-trigger"));
      await waitFor(() =>
        expect(screen.getByText("Something went wrong. Please try again.")).toBeTruthy()
      );
    });

    it("does nothing when the submission resolves with no booking at all", async () => {
      (createBooking as jest.Mock).mockResolvedValue(null);
      renderWithProviders(<BookingDrawer {...baseProps} />);
      fireEvent.press(screen.getByTestId("submit-trigger"));
      await waitFor(() => expect(createBooking).toHaveBeenCalled());
      expect(mockPush).not.toHaveBeenCalled();
      expect(screen.queryByText("Something went wrong. Please try again.")).toBeNull();
    });
  });
});

describe("shouldDismissSheet", () => {
  it("dismisses on a long drag regardless of speed", () => {
    expect(shouldDismissSheet(121, 0)).toBe(true);
  });

  it("dismisses on a short but fast downward flick", () => {
    expect(shouldDismissSheet(60, 0.9)).toBe(true);
  });

  it("springs back from a short slow drag", () => {
    expect(shouldDismissSheet(60, 0.2)).toBe(false);
    expect(shouldDismissSheet(10, 2)).toBe(false);
  });

  it("never dismisses on an upward drag", () => {
    expect(shouldDismissSheet(-200, -3)).toBe(false);
  });
});
