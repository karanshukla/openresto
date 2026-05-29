import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react-native";
import { BookingDetailPopup } from "@/components/admin/bookings/BookingDetailPopup";
import * as adminApi from "@/api/admin";
import * as restaurantsApi from "@/api/restaurants";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/admin", () => ({
  getAdminBooking: jest.fn(),
  adminDeleteBooking: jest.fn(),
  adminExtendBooking: jest.fn(),
  adminPurgeBooking: jest.fn(),
  sendBookingEmail: jest.fn(),
  adminRestoreBooking: jest.fn(),
  adminUpdateBookingFull: jest.fn(),
}));

jest.mock("@/api/restaurants", () => ({
  fetchRestaurants: jest.fn(),
}));

jest.mock("@/context/BrandContext", () => {
  const brand = { primaryColor: "#0a7ea4", appName: "Open Resto" };
  return { useBrand: () => brand };
});

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/components/admin/bookings/BookingDetailsCard", () => {
  const { View, Text } = require("react-native");
  return {
    BookingDetailsCard: ({ booking }: { booking: { bookingRef: string } }) => (
      <View>
        <Text testID="booking-details-card">{booking.bookingRef}</Text>
      </View>
    ),
  };
});

jest.mock("@/components/admin/bookings/EditBookingForm", () => {
  const { View } = require("react-native");
  return { EditBookingForm: () => <View testID="edit-booking-form" /> };
});

jest.mock("@/components/admin/bookings/ExtendBookingActions", () => {
  const { View } = require("react-native");
  return { ExtendBookingActions: () => <View testID="extend-booking-actions" /> };
});

jest.mock("@/components/admin/bookings/EmailGuestForm", () => {
  const { View } = require("react-native");
  return { EmailGuestForm: () => <View testID="email-guest-form" /> };
});

jest.mock("@/components/admin/bookings/BookingActionButtons", () => {
  const { View } = require("react-native");
  return { BookingActionButtons: () => <View testID="booking-action-buttons" /> };
});

jest.mock("@/components/common/ConfirmModal", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View /> };
});

jest.mock("@/components/common/AlertModal", () => {
  const { View } = require("react-native");
  return { __esModule: true, default: () => <View /> };
});

const mockBooking = {
  id: 42,
  bookingRef: "REF-001",
  customerName: "Jane Doe",
  customerEmail: "jane@example.com",
  date: "2026-06-15T19:00:00Z",
  seats: 2,
  tableId: 100,
  sectionId: 10,
  restaurantId: 1,
  isCancelled: false,
  specialRequests: null,
  endTime: null,
  status: "confirmed",
};

describe("BookingDetailPopup", () => {
  const onClose = jest.fn();
  const onDeleted = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (restaurantsApi.fetchRestaurants as jest.Mock).mockResolvedValue([]);
  });

  it("does not show Booking Details when bookingId is null", () => {
    (adminApi.getAdminBooking as jest.Mock).mockResolvedValue(null);
    render(<BookingDetailPopup bookingId={null} onClose={onClose} />);
    expect(screen.queryByText("Booking Details")).toBeNull();
  });

  it("shows Booking Details title when bookingId is set", async () => {
    (adminApi.getAdminBooking as jest.Mock).mockResolvedValue(mockBooking);
    render(<BookingDetailPopup bookingId={42} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText("Booking Details")).toBeTruthy();
    });
  });

  it("calls getAdminBooking with the bookingId", async () => {
    (adminApi.getAdminBooking as jest.Mock).mockResolvedValue(mockBooking);
    render(<BookingDetailPopup bookingId={42} onClose={onClose} />);
    await waitFor(() => {
      expect(adminApi.getAdminBooking).toHaveBeenCalledWith(42);
    });
  });

  it("shows booking details card after loading", async () => {
    (adminApi.getAdminBooking as jest.Mock).mockResolvedValue(mockBooking);
    render(<BookingDetailPopup bookingId={42} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByTestId("booking-details-card")).toBeTruthy();
    });
  });

  it("shows Booking not found when booking is null", async () => {
    (adminApi.getAdminBooking as jest.Mock).mockResolvedValue(null);
    render(<BookingDetailPopup bookingId={99} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText("Booking not found.")).toBeTruthy();
    });
  });

  it("shows extend actions and action buttons for loaded booking", async () => {
    (adminApi.getAdminBooking as jest.Mock).mockResolvedValue(mockBooking);
    render(<BookingDetailPopup bookingId={42} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByTestId("extend-booking-actions")).toBeTruthy();
      expect(screen.getByTestId("booking-action-buttons")).toBeTruthy();
    });
  });

  it("resets booking when bookingId becomes null", async () => {
    (adminApi.getAdminBooking as jest.Mock).mockResolvedValue(mockBooking);
    const { rerender } = render(<BookingDetailPopup bookingId={42} onClose={onClose} />);
    await waitFor(() => expect(screen.getByText("Booking Details")).toBeTruthy());

    await act(async () => {
      rerender(<BookingDetailPopup bookingId={null} onClose={onClose} />);
    });
    expect(screen.queryByText("Booking Details")).toBeNull();
  });
});
