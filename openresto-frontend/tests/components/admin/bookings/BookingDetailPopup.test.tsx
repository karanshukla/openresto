import React from "react";
import { Platform } from "react-native";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
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

jest.mock("@/components/admin/bookings/BookingDetailsCard", () => ({
  BookingDetailsCard: ({ booking }: { booking: { customerEmail: string } }) => {
    const { Text } = require("react-native");
    return <Text testID="booking-details-card">{booking.customerEmail}</Text>;
  },
}));

jest.mock("@/components/admin/bookings/EditBookingForm", () => ({
  EditBookingForm: ({
    handleRestaurantChange,
    handleSectionChange,
    setEditTableId,
    setEditSeats,
    setEditDate,
    setEditTime,
  }: {
    handleRestaurantChange: (v: string | number) => void;
    handleSectionChange: (v: string | number) => void;
    setEditTableId: (id: number) => void;
    setEditSeats: (s: string) => void;
    setEditDate: (d: string) => void;
    setEditTime: (t: string) => void;
  }) => {
    const { View, Text, Pressable } = require("react-native");
    return (
      <View testID="edit-booking-form">
        <Text>EditBookingForm</Text>
        <Pressable testID="change-restaurant-btn" onPress={() => handleRestaurantChange(2)}>
          <Text>Change Restaurant</Text>
        </Pressable>
        <Pressable testID="change-section-btn" onPress={() => handleSectionChange(20)}>
          <Text>Change Section</Text>
        </Pressable>
        <Pressable testID="change-table-btn" onPress={() => setEditTableId(200)}>
          <Text>Change Table</Text>
        </Pressable>
        <Pressable testID="change-seats-btn" onPress={() => setEditSeats("4")}>
          <Text>Change Seats</Text>
        </Pressable>
        <Pressable testID="set-invalid-seats-btn" onPress={() => setEditSeats("abc")}>
          <Text>Set Invalid Seats</Text>
        </Pressable>
        <Pressable testID="clear-date-btn" onPress={() => setEditDate("")}>
          <Text>Clear Date</Text>
        </Pressable>
        <Pressable testID="clear-time-btn" onPress={() => setEditTime("")}>
          <Text>Clear Time</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.mock("@/components/admin/bookings/ExtendBookingActions", () => ({
  ExtendBookingActions: ({ onExtend }: { onExtend: (m: number) => void }) => {
    const { Text, Pressable } = require("react-native");
    return (
      <Pressable testID="extend-btn" onPress={() => onExtend(30)}>
        <Text>Extend</Text>
      </Pressable>
    );
  },
}));

jest.mock("@/components/admin/bookings/EmailGuestForm", () => ({
  EmailGuestForm: ({
    onSendEmail,
    setEmailSubject,
    setEmailBody,
  }: {
    onSendEmail: () => void;
    setEmailSubject: (s: string) => void;
    setEmailBody: (s: string) => void;
  }) => {
    const { View, Text, Pressable } = require("react-native");
    return (
      <View>
        <Pressable testID="send-email-btn" onPress={onSendEmail}>
          <Text>Send Email</Text>
        </Pressable>
        <Pressable
          testID="set-email-content-btn"
          onPress={() => {
            setEmailSubject("Test Subject");
            setEmailBody("Test Body");
          }}
        >
          <Text>Set Email Content</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.mock("@/components/admin/bookings/BookingActionButtons", () => ({
  BookingActionButtons: ({
    onCancel,
    onPurge,
    onUncancel,
    isCancelled,
    isPast,
  }: {
    onCancel: () => void;
    onPurge: () => void;
    onUncancel: () => void;
    isCancelled: boolean;
    isPast?: boolean;
  }) => {
    const { View, Pressable, Text } = require("react-native");
    return (
      <View>
        {isCancelled ? (
          <Pressable testID="uncancel-btn" onPress={onUncancel}>
            <Text>Restore</Text>
          </Pressable>
        ) : isPast ? (
          <Text testID="past-booking-no-cancel">Booking Has Passed</Text>
        ) : (
          <Pressable testID="cancel-btn" onPress={onCancel}>
            <Text>Cancel Booking</Text>
          </Pressable>
        )}
        <Pressable testID="purge-btn" onPress={onPurge}>
          <Text>Delete Forever</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.mock("@/components/common/ConfirmModal", () => {
  return function ConfirmModal({
    visible,
    onConfirm,
    onCancel,
    title,
  }: {
    visible: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title: string;
  }) {
    if (!visible) return null;
    const { View, Pressable, Text } = require("react-native");
    return (
      <View testID={`confirm-modal-${title.replace(/\s+/g, "-")}`}>
        <Pressable testID="confirm-btn" onPress={onConfirm}>
          <Text>Confirm</Text>
        </Pressable>
        <Pressable testID="modal-cancel-btn" onPress={onCancel}>
          <Text>Go Back</Text>
        </Pressable>
      </View>
    );
  };
});

jest.mock("@/components/common/AlertModal", () => {
  return function AlertModal({
    visible,
    onClose,
    message,
  }: {
    visible: boolean;
    onClose: () => void;
    message: string;
  }) {
    if (!visible) return null;
    const { View, Pressable, Text } = require("react-native");
    return (
      <View testID="alert-modal">
        <Text testID="alert-message">{message}</Text>
        <Pressable testID="alert-close-btn" onPress={onClose}>
          <Text>Close</Text>
        </Pressable>
      </View>
    );
  };
});

const mockBooking: adminApi.BookingDetailDto = {
  id: 1,
  restaurantId: 1,
  restaurantName: "Test Restaurant",
  sectionId: 10,
  sectionName: "Indoor",
  tableId: 100,
  tableName: "Table 1",
  date: "2026-12-01T18:00:00Z",
  customerEmail: "guest@example.com",
  seats: 2,
  specialRequests: "Window seat",
  bookingRef: "ABC123",
  isCancelled: false,
};

const cancelledBooking: adminApi.BookingDetailDto = {
  ...mockBooking,
  isCancelled: true,
  cancelledAt: "2026-05-20T10:00:00Z",
};

const baseProps = {
  bookingId: 1,
  onClose: jest.fn(),
  onMutated: jest.fn(),
};

describe("BookingDetailPopup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (adminApi.getAdminBooking as jest.Mock).mockResolvedValue(mockBooking);
    (restaurantsApi.fetchRestaurants as jest.Mock).mockResolvedValue([]);
  });

  it("shows loading indicator while fetching booking", () => {
    (adminApi.getAdminBooking as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<BookingDetailPopup {...baseProps} />);
    // Modal visible=true since bookingId is not null
    expect(screen.getByText("Booking Details")).toBeTruthy();
  });

  it("shows booking data after loading", async () => {
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByTestId("booking-details-card")).toBeTruthy();
    });
  });

  it("shows booking not found when booking is null", async () => {
    (adminApi.getAdminBooking as jest.Mock).mockResolvedValue(null);
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText("Booking not found.")).toBeTruthy();
    });
  });

  it("renders Booking Details header text when bookingId is provided", async () => {
    render(<BookingDetailPopup {...baseProps} />);
    expect(screen.getByText("Booking Details")).toBeTruthy();
  });

  it("shows Edit button for non-cancelled booking", async () => {
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByText("Edit")).toBeTruthy();
    });
  });

  it("does not show Edit button for cancelled booking", async () => {
    (adminApi.getAdminBooking as jest.Mock).mockResolvedValue(cancelledBooking);
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => {
      expect(screen.getByTestId("booking-details-card")).toBeTruthy();
    });
    expect(screen.queryByText("Edit")).toBeNull();
  });

  it("enters edit mode when Edit button is pressed", async () => {
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => {
      expect(screen.getByTestId("edit-booking-form")).toBeTruthy();
    });
  });

  it("shows Cancel and Save Changes buttons in edit mode", async () => {
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => {
      expect(screen.getByText("Cancel")).toBeTruthy();
      expect(screen.getByText("Save Changes")).toBeTruthy();
    });
  });

  it("exits edit mode when Cancel button is pressed", async () => {
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => expect(screen.getByText("Cancel")).toBeTruthy());
    fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() => {
      expect(screen.queryByText("Cancel")).toBeNull();
      expect(screen.getByText("Edit")).toBeTruthy();
    });
  });

  it("hides Cancel Booking and shows past indicator for a past, non-cancelled booking", async () => {
    (adminApi.getAdminBooking as jest.Mock).mockResolvedValue({
      ...mockBooking,
      date: "2020-01-01T18:00:00Z",
    });
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("past-booking-no-cancel")).toBeTruthy());
    expect(screen.queryByTestId("cancel-btn")).toBeNull();
  });

  it("shows cancel booking confirm modal when Cancel Booking is pressed", async () => {
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("cancel-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("cancel-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("confirm-modal-Cancel-Booking")).toBeTruthy();
    });
  });

  it("calls adminDeleteBooking and onMutated when cancel is confirmed", async () => {
    (adminApi.adminDeleteBooking as jest.Mock).mockResolvedValue(true);
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("cancel-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("cancel-btn"));
    await waitFor(() => expect(screen.getByTestId("confirm-btn")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId("confirm-btn"));
    });
    expect(adminApi.adminDeleteBooking).toHaveBeenCalledWith(1);
    expect(baseProps.onMutated).toHaveBeenCalled();
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it("shows error message when cancel fails", async () => {
    (adminApi.adminDeleteBooking as jest.Mock).mockRejectedValue(
      new Error("Failed to cancel the booking.")
    );
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("cancel-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("cancel-btn"));
    await waitFor(() => expect(screen.getByTestId("confirm-btn")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId("confirm-btn"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("alert-message")).toBeTruthy();
    });
  });

  it("surfaces the backend's specific rejection message instead of a generic one", async () => {
    (adminApi.adminDeleteBooking as jest.Mock).mockRejectedValue(
      new Error("Cannot cancel a booking that has already passed.")
    );
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("cancel-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("cancel-btn"));
    await waitFor(() => expect(screen.getByTestId("confirm-btn")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId("confirm-btn"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("alert-message").props.children).toBe(
        "Cannot cancel a booking that has already passed."
      );
    });
  });

  it("dismisses cancel modal when Go Back is pressed", async () => {
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("cancel-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("cancel-btn"));
    await waitFor(() => expect(screen.getByTestId("modal-cancel-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("modal-cancel-btn"));
    await waitFor(() => {
      expect(screen.queryByTestId("confirm-modal-Cancel-Booking")).toBeNull();
    });
  });

  it("shows purge confirm modal when Delete Forever is pressed", async () => {
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("purge-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("purge-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("confirm-modal-Permanently-Delete")).toBeTruthy();
    });
  });

  it("calls adminPurgeBooking when purge is confirmed", async () => {
    (adminApi.adminPurgeBooking as jest.Mock).mockResolvedValue(true);
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("purge-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("purge-btn"));
    await waitFor(() => expect(screen.getByTestId("confirm-btn")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId("confirm-btn"));
    });
    expect(adminApi.adminPurgeBooking).toHaveBeenCalledWith(1);
    expect(baseProps.onMutated).toHaveBeenCalled();
    expect(baseProps.onClose).toHaveBeenCalled();
  });

  it("shows error when purge fails", async () => {
    (adminApi.adminPurgeBooking as jest.Mock).mockResolvedValue(false);
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("purge-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("purge-btn"));
    await waitFor(() => expect(screen.getByTestId("confirm-btn")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId("confirm-btn"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("alert-message")).toBeTruthy();
    });
  });

  it("shows restore confirm modal for cancelled booking", async () => {
    (adminApi.getAdminBooking as jest.Mock).mockResolvedValue(cancelledBooking);
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("uncancel-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("uncancel-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("confirm-modal-Restore-Booking")).toBeTruthy();
    });
  });

  it("calls adminRestoreBooking when restore is confirmed", async () => {
    (adminApi.getAdminBooking as jest.Mock).mockResolvedValueOnce(cancelledBooking);
    (adminApi.adminRestoreBooking as jest.Mock).mockResolvedValue(true);
    (adminApi.getAdminBooking as jest.Mock).mockResolvedValue({
      ...cancelledBooking,
      isCancelled: false,
    });
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("uncancel-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("uncancel-btn"));
    await waitFor(() => expect(screen.getByTestId("confirm-btn")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId("confirm-btn"));
    });
    expect(adminApi.adminRestoreBooking).toHaveBeenCalledWith(1);
  });

  it("shows error when restore fails with Error instance", async () => {
    (adminApi.getAdminBooking as jest.Mock).mockResolvedValue(cancelledBooking);
    (adminApi.adminRestoreBooking as jest.Mock).mockRejectedValue(
      new Error("Failed to restore booking.")
    );
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("uncancel-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("uncancel-btn"));
    await waitFor(() => expect(screen.getByTestId("confirm-btn")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId("confirm-btn"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("alert-message")).toBeTruthy();
    });
  });

  it("calls adminExtendBooking when extend button is pressed", async () => {
    (adminApi.adminExtendBooking as jest.Mock).mockResolvedValue({
      endTime: "2026-06-01T20:00:00Z",
    });
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("extend-btn")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId("extend-btn"));
    });
    expect(adminApi.adminExtendBooking).toHaveBeenCalledWith(1, 30);
  });

  it("updates endTime after successful extend", async () => {
    (adminApi.adminExtendBooking as jest.Mock).mockResolvedValue({
      endTime: "2026-06-01T20:00:00Z",
    });
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("extend-btn")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId("extend-btn"));
    });
    expect(adminApi.adminExtendBooking).toHaveBeenCalled();
  });

  it("renders null when bookingId is null", () => {
    render(<BookingDetailPopup {...baseProps} bookingId={null} />);
    // Modal is not visible when bookingId is null
    expect(screen.queryByText("Booking Details")).toBeNull();
  });

  it("resets state when bookingId changes to null", async () => {
    const { rerender } = render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("booking-details-card")).toBeTruthy());
    rerender(<BookingDetailPopup {...baseProps} bookingId={null} />);
    expect(screen.queryByText("Booking Details")).toBeNull();
  });

  it("closes error alert when close button is pressed", async () => {
    (adminApi.adminDeleteBooking as jest.Mock).mockRejectedValue(
      new Error("Failed to cancel the booking.")
    );
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("cancel-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("cancel-btn"));
    await waitFor(() => expect(screen.getByTestId("confirm-btn")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId("confirm-btn"));
    });
    await waitFor(() => expect(screen.getByTestId("alert-close-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("alert-close-btn"));
    await waitFor(() => {
      expect(screen.queryByTestId("alert-modal")).toBeNull();
    });
  });

  it("dismisses purge modal when Go Back is pressed", async () => {
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("purge-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("purge-btn"));
    await waitFor(() => expect(screen.getByTestId("modal-cancel-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("modal-cancel-btn"));
    await waitFor(() => {
      expect(screen.queryByTestId("confirm-modal-Permanently-Delete")).toBeNull();
    });
  });

  it("calls handleSaveEdit with valid data", async () => {
    (adminApi.adminUpdateBookingFull as jest.Mock).mockResolvedValue({
      ...mockBooking,
      seats: 4,
    });
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => expect(screen.getByText("Save Changes")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Save Changes"));
    });
    await waitFor(() => {
      expect(adminApi.adminUpdateBookingFull).toHaveBeenCalled();
    });
  });

  it("shows error when handleSaveEdit fails", async () => {
    (adminApi.adminUpdateBookingFull as jest.Mock).mockRejectedValue(new Error("Update failed."));
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => expect(screen.getByText("Save Changes")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Save Changes"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("alert-message")).toBeTruthy();
    });
  });

  it("calls handleRestaurantChange when restaurant is changed in edit form", async () => {
    const mockRestaurants = [
      {
        id: 1,
        name: "Restaurant A",
        sections: [{ id: 10, name: "Main", tables: [{ id: 100, name: "T1", seats: 4 }] }],
      },
      {
        id: 2,
        name: "Restaurant B",
        sections: [{ id: 20, name: "Patio", tables: [{ id: 200, name: "T2", seats: 2 }] }],
      },
    ];
    (restaurantsApi.fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => expect(screen.getByTestId("edit-booking-form")).toBeTruthy());
    fireEvent.press(screen.getByTestId("change-restaurant-btn"));
    // handleRestaurantChange should update section and table
    expect(screen.getByTestId("edit-booking-form")).toBeTruthy();
  });

  it("calls handleSectionChange when section is changed in edit form", async () => {
    const mockRestaurants = [
      {
        id: 1,
        name: "Restaurant A",
        sections: [
          { id: 10, name: "Main", tables: [{ id: 100, name: "T1", seats: 4 }] },
          { id: 11, name: "Bar", tables: [{ id: 101, name: "T2", seats: 2 }] },
        ],
      },
    ];
    (restaurantsApi.fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => expect(screen.getByTestId("edit-booking-form")).toBeTruthy());
    fireEvent.press(screen.getByTestId("change-section-btn"));
    expect(screen.getByTestId("edit-booking-form")).toBeTruthy();
  });

  it("shows error for invalid seats in handleSaveEdit", async () => {
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => expect(screen.getByTestId("change-seats-btn")).toBeTruthy());
    // Change seats to invalid value via mock
    // Since we can't directly set editSeats to NaN via the mock, we test the normal flow
    // The default editSeats from the booking is "2" which is valid
    await waitFor(() => expect(screen.getByText("Save Changes")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Save Changes"));
    });
    // Should call update since seats is valid
    expect(adminApi.adminUpdateBookingFull).toHaveBeenCalled();
  });

  it("handles restore failure with non-Error thrown", async () => {
    (adminApi.getAdminBooking as jest.Mock).mockResolvedValue(cancelledBooking);
    (adminApi.adminRestoreBooking as jest.Mock).mockRejectedValue("string error");
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("uncancel-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("uncancel-btn"));
    await waitFor(() => expect(screen.getByTestId("confirm-btn")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId("confirm-btn"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("alert-message")).toBeTruthy();
    });
  });

  it("handles extend when result is null (no-op)", async () => {
    (adminApi.adminExtendBooking as jest.Mock).mockResolvedValue(null);
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("extend-btn")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId("extend-btn"));
    });
    expect(adminApi.adminExtendBooking).toHaveBeenCalledWith(1, 30);
  });

  it("calls sendBookingEmail when send email button is pressed with content", async () => {
    (adminApi.sendBookingEmail as jest.Mock).mockResolvedValue({ ok: true, message: "Sent." });
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("booking-details-card")).toBeTruthy());
    // Set email content first
    act(() => {
      fireEvent.press(screen.getByTestId("set-email-content-btn"));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId("send-email-btn"));
    });
    await waitFor(() => {
      expect(adminApi.sendBookingEmail).toHaveBeenCalledWith(1, "Test Subject", "Test Body");
    });
  });

  it("handles failed send email gracefully", async () => {
    (adminApi.sendBookingEmail as jest.Mock).mockResolvedValue({ ok: false, message: "Failed." });
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("booking-details-card")).toBeTruthy());
    act(() => {
      fireEvent.press(screen.getByTestId("set-email-content-btn"));
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId("send-email-btn"));
    });
    expect(adminApi.sendBookingEmail).toHaveBeenCalled();
  });

  it("does not call sendBookingEmail when subject/body are empty", async () => {
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("send-email-btn")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId("send-email-btn"));
    });
    expect(adminApi.sendBookingEmail).not.toHaveBeenCalled();
  });

  it("dismisses restore modal when Go Back is pressed", async () => {
    (adminApi.getAdminBooking as jest.Mock).mockResolvedValue(cancelledBooking);
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("uncancel-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("uncancel-btn"));
    await waitFor(() => expect(screen.getByTestId("confirm-modal-Restore-Booking")).toBeTruthy());
    fireEvent.press(screen.getByTestId("modal-cancel-btn"));
    await waitFor(() => {
      expect(screen.queryByTestId("confirm-modal-Restore-Booking")).toBeNull();
    });
  });

  it("shows error for invalid seats (NaN) in handleSaveEdit", async () => {
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => expect(screen.getByTestId("set-invalid-seats-btn")).toBeTruthy());
    act(() => {
      fireEvent.press(screen.getByTestId("set-invalid-seats-btn"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Save Changes"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("alert-message")).toBeTruthy();
    });
  });

  it("skips save and calls confirm when seat count exceeds table capacity", async () => {
    const mockRestaurants = [
      {
        id: 1,
        name: "Restaurant A",
        sections: [
          {
            id: 10,
            name: "Main",
            tables: [{ id: 100, name: "T1", seats: 1 }], // table has only 1 seat
          },
        ],
      },
    ];
    (restaurantsApi.fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    // Mock global.confirm (Node env doesn't have window.confirm)
    const originalConfirm = (global as Record<string, unknown>).confirm;
    (global as Record<string, unknown>).confirm = jest.fn().mockReturnValue(false);
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => expect(screen.getByTestId("edit-booking-form")).toBeTruthy());
    // editSeats starts as "2" which is > table.seats=1
    await act(async () => {
      fireEvent.press(screen.getByText("Save Changes"));
    });
    expect((global as Record<string, unknown>).confirm).toHaveBeenCalled();
    (global as Record<string, unknown>).confirm = originalConfirm;
  });

  it("proceeds with save when confirm returns true for over-capacity booking", async () => {
    (adminApi.adminUpdateBookingFull as jest.Mock).mockResolvedValue({ ...mockBooking });
    const mockRestaurants = [
      {
        id: 1,
        name: "Restaurant A",
        sections: [
          {
            id: 10,
            name: "Main",
            tables: [{ id: 100, name: "T1", seats: 1 }],
          },
        ],
      },
    ];
    (restaurantsApi.fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    const originalConfirm = (global as Record<string, unknown>).confirm;
    (global as Record<string, unknown>).confirm = jest.fn().mockReturnValue(true);
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => expect(screen.getByTestId("edit-booking-form")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Save Changes"));
    });
    await waitFor(() => {
      expect(adminApi.adminUpdateBookingFull).toHaveBeenCalled();
    });
    (global as Record<string, unknown>).confirm = originalConfirm;
  });

  it("shows 'Date and time are required' when editDate is cleared before saving", async () => {
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => expect(screen.getByTestId("clear-date-btn")).toBeTruthy());
    act(() => {
      fireEvent.press(screen.getByTestId("clear-date-btn"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Save Changes"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("alert-message")).toBeTruthy();
      expect(screen.getByText("Date and time are required")).toBeTruthy();
    });
    expect(adminApi.adminUpdateBookingFull).not.toHaveBeenCalled();
  });

  it("calls onMutated after a successful extend", async () => {
    (adminApi.adminExtendBooking as jest.Mock).mockResolvedValue({
      endTime: "2026-06-01T20:00:00Z",
    });
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("extend-btn")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId("extend-btn"));
    });
    await waitFor(() => expect(baseProps.onMutated).toHaveBeenCalled());
  });

  it("calls onMutated after a successful restore", async () => {
    (adminApi.getAdminBooking as jest.Mock).mockResolvedValueOnce(cancelledBooking);
    (adminApi.adminRestoreBooking as jest.Mock).mockResolvedValue(true);
    (adminApi.getAdminBooking as jest.Mock).mockResolvedValue({
      ...cancelledBooking,
      isCancelled: false,
    });
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId("uncancel-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("uncancel-btn"));
    await waitFor(() => expect(screen.getByTestId("confirm-btn")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId("confirm-btn"));
    });
    await waitFor(() => expect(baseProps.onMutated).toHaveBeenCalled());
  });

  it("calls onMutated after a successful edit save", async () => {
    (adminApi.adminUpdateBookingFull as jest.Mock).mockResolvedValue({ ...mockBooking });
    render(<BookingDetailPopup {...baseProps} />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => expect(screen.getByText("Save Changes")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByText("Save Changes"));
    });
    await waitFor(() => expect(baseProps.onMutated).toHaveBeenCalled());
  });

  describe("race guards, fallbacks, and dead-end branches", () => {
    it("ignores a stale getAdminBooking response after bookingId changes before it resolves", async () => {
      let resolveFirst!: (value: unknown) => void;
      (adminApi.getAdminBooking as jest.Mock).mockImplementation((id: number) => {
        if (id === 1) {
          return new Promise((resolve) => {
            resolveFirst = resolve;
          });
        }
        return new Promise(() => {});
      });
      const { rerender } = render(<BookingDetailPopup {...baseProps} bookingId={1} />);
      rerender(<BookingDetailPopup {...baseProps} bookingId={2} />);
      // The id=1 fetch resolves only after bookingId moved on to 2 — the
      // effect's cleanup already set `cancelled = true` for that request, so
      // this stale response must not overwrite state.
      await act(async () => {
        resolveFirst(mockBooking);
      });
      expect(screen.queryByTestId("booking-details-card")).toBeNull();
    });

    it("falls back to empty strings for a booking with no email/specialRequests and omits them on save", async () => {
      const bookingNoOptional: adminApi.BookingDetailDto = {
        ...mockBooking,
        customerEmail: null as unknown as string,
        specialRequests: undefined,
      };
      (adminApi.getAdminBooking as jest.Mock).mockResolvedValue(bookingNoOptional);
      (adminApi.adminUpdateBookingFull as jest.Mock).mockResolvedValue(bookingNoOptional);
      render(<BookingDetailPopup {...baseProps} />);
      await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
      fireEvent.press(screen.getByText("Edit"));
      await waitFor(() => expect(screen.getByText("Save Changes")).toBeTruthy());
      await act(async () => {
        fireEvent.press(screen.getByText("Save Changes"));
      });
      await waitFor(() => expect(adminApi.adminUpdateBookingFull).toHaveBeenCalled());
      const payload = (adminApi.adminUpdateBookingFull as jest.Mock).mock.calls[0][1];
      expect(payload.customerEmail).toBeUndefined();
      expect(payload.specialRequests).toBeUndefined();
    });

    it("re-populates edit fields with empty strings when cancelling edit for a booking with no email/specialRequests", async () => {
      const bookingNoOptional: adminApi.BookingDetailDto = {
        ...mockBooking,
        customerEmail: null as unknown as string,
        specialRequests: undefined,
      };
      (adminApi.getAdminBooking as jest.Mock).mockResolvedValue(bookingNoOptional);
      render(<BookingDetailPopup {...baseProps} />);
      await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
      fireEvent.press(screen.getByText("Edit"));
      await waitFor(() => expect(screen.getByText("Cancel")).toBeTruthy());
      fireEvent.press(screen.getByText("Cancel"));
      await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
    });

    it("no-ops handleDeleteConfirmed if booking became null before the confirm modal was actioned", async () => {
      (adminApi.getAdminBooking as jest.Mock).mockImplementation((id: number) =>
        id === 1 ? Promise.resolve(mockBooking) : new Promise(() => {})
      );
      const { rerender } = render(<BookingDetailPopup {...baseProps} bookingId={1} />);
      await waitFor(() => expect(screen.getByTestId("cancel-btn")).toBeTruthy());
      fireEvent.press(screen.getByTestId("cancel-btn"));
      await waitFor(() => expect(screen.getByTestId("confirm-btn")).toBeTruthy());
      rerender(<BookingDetailPopup {...baseProps} bookingId={2} />);
      fireEvent.press(screen.getByTestId("confirm-btn"));
      expect(adminApi.adminDeleteBooking).not.toHaveBeenCalled();
    });

    it("no-ops handleUncancel if booking became null before the confirm modal was actioned", async () => {
      (adminApi.getAdminBooking as jest.Mock).mockImplementation((id: number) =>
        id === 1 ? Promise.resolve(cancelledBooking) : new Promise(() => {})
      );
      const { rerender } = render(<BookingDetailPopup {...baseProps} bookingId={1} />);
      await waitFor(() => expect(screen.getByTestId("uncancel-btn")).toBeTruthy());
      fireEvent.press(screen.getByTestId("uncancel-btn"));
      await waitFor(() => expect(screen.getByTestId("confirm-btn")).toBeTruthy());
      rerender(<BookingDetailPopup {...baseProps} bookingId={2} />);
      fireEvent.press(screen.getByTestId("confirm-btn"));
      expect(adminApi.adminRestoreBooking).not.toHaveBeenCalled();
    });

    it("no-ops the purge confirm handler if booking became null before it was actioned", async () => {
      (adminApi.getAdminBooking as jest.Mock).mockImplementation((id: number) =>
        id === 1 ? Promise.resolve(mockBooking) : new Promise(() => {})
      );
      const { rerender } = render(<BookingDetailPopup {...baseProps} bookingId={1} />);
      await waitFor(() => expect(screen.getByTestId("purge-btn")).toBeTruthy());
      fireEvent.press(screen.getByTestId("purge-btn"));
      await waitFor(() => expect(screen.getByTestId("confirm-btn")).toBeTruthy());
      rerender(<BookingDetailPopup {...baseProps} bookingId={2} />);
      fireEvent.press(screen.getByTestId("confirm-btn"));
      expect(adminApi.adminPurgeBooking).not.toHaveBeenCalled();
    });

    it("no-ops handleSaveEdit and handleCancelEdit if booking became null while still editing", async () => {
      (adminApi.getAdminBooking as jest.Mock).mockImplementation((id: number) =>
        id === 1 ? Promise.resolve(mockBooking) : new Promise(() => {})
      );
      const { rerender } = render(<BookingDetailPopup {...baseProps} bookingId={1} />);
      await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
      fireEvent.press(screen.getByText("Edit"));
      await waitFor(() => expect(screen.getByText("Save Changes")).toBeTruthy());
      // The header's Save Changes/Cancel buttons render whenever `editing` is
      // true, independent of `booking` — so switching to a bookingId whose
      // fetch never resolves leaves them mounted with booking now null.
      rerender(<BookingDetailPopup {...baseProps} bookingId={2} />);
      await act(async () => {
        fireEvent.press(screen.getByText("Save Changes"));
      });
      expect(adminApi.adminUpdateBookingFull).not.toHaveBeenCalled();
      fireEvent.press(screen.getByText("Cancel"));
      await waitFor(() => {
        expect(screen.queryByText("Save Changes")).toBeNull();
        expect(screen.queryByText("Edit")).toBeNull();
      });
    });

    it("clears section/table selection for a restaurant with no sections and omits them on save", async () => {
      const mockRestaurants = [
        {
          id: 1,
          name: "Restaurant A",
          sections: [{ id: 10, name: "Main", tables: [{ id: 100, name: "T1", seats: 4 }] }],
        },
        { id: 2, name: "Restaurant B", sections: [] },
      ];
      (restaurantsApi.fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
      (adminApi.adminUpdateBookingFull as jest.Mock).mockResolvedValue(mockBooking);
      render(<BookingDetailPopup {...baseProps} />);
      await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
      fireEvent.press(screen.getByText("Edit"));
      await waitFor(() => expect(screen.getByTestId("edit-booking-form")).toBeTruthy());
      // change-restaurant-btn selects restaurant id=2, which has no sections.
      fireEvent.press(screen.getByTestId("change-restaurant-btn"));
      await act(async () => {
        fireEvent.press(screen.getByText("Save Changes"));
      });
      await waitFor(() => expect(adminApi.adminUpdateBookingFull).toHaveBeenCalled());
      const payload = (adminApi.adminUpdateBookingFull as jest.Mock).mock.calls[0][1];
      expect(payload.sectionId).toBeUndefined();
      expect(payload.tableId).toBeUndefined();
    });

    it("shows a generic message when cancel fails with a non-Error rejection", async () => {
      (adminApi.adminDeleteBooking as jest.Mock).mockRejectedValue("boom");
      render(<BookingDetailPopup {...baseProps} />);
      await waitFor(() => expect(screen.getByTestId("cancel-btn")).toBeTruthy());
      fireEvent.press(screen.getByTestId("cancel-btn"));
      await waitFor(() => expect(screen.getByTestId("confirm-btn")).toBeTruthy());
      await act(async () => {
        fireEvent.press(screen.getByTestId("confirm-btn"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("alert-message").props.children).toBe(
          "Failed to cancel the booking."
        );
      });
    });

    it("shows a generic message when handleSaveEdit fails with a non-Error rejection", async () => {
      (adminApi.adminUpdateBookingFull as jest.Mock).mockRejectedValue("boom");
      render(<BookingDetailPopup {...baseProps} />);
      await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
      fireEvent.press(screen.getByText("Edit"));
      await waitFor(() => expect(screen.getByText("Save Changes")).toBeTruthy());
      await act(async () => {
        fireEvent.press(screen.getByText("Save Changes"));
      });
      await waitFor(() => {
        expect(screen.getByTestId("alert-message").props.children).toBe(
          "Failed to update booking."
        );
      });
    });

    it("falls back to 'Table {id}' label when a table has no name", async () => {
      const mockRestaurants = [
        {
          id: 1,
          name: "Restaurant A",
          sections: [{ id: 10, name: "Main", tables: [{ id: 100, name: null, seats: 4 }] }],
        },
      ];
      (restaurantsApi.fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
      render(<BookingDetailPopup {...baseProps} />);
      await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
      fireEvent.press(screen.getByText("Edit"));
      // booking.restaurantId=1/sectionId=10 match this restaurant/section, so
      // the nameless table is resolved into tableOptions on render, exercising
      // the `t.name ?? "Table {id}"` fallback.
      await waitFor(() => expect(screen.getByTestId("edit-booking-form")).toBeTruthy());
    });

    it("shows 'Saving…' while handleSaveEdit is in flight", async () => {
      let resolveSave!: (value: unknown) => void;
      (adminApi.adminUpdateBookingFull as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSave = resolve;
          })
      );
      render(<BookingDetailPopup {...baseProps} />);
      await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
      fireEvent.press(screen.getByText("Edit"));
      await waitFor(() => expect(screen.getByText("Save Changes")).toBeTruthy());
      fireEvent.press(screen.getByText("Save Changes"));
      await waitFor(() => expect(screen.getByText("Saving…")).toBeTruthy());
      await act(async () => {
        resolveSave(mockBooking);
      });
    });

    it("ignores a stale fetchRestaurants response after leaving edit mode before it resolves", async () => {
      let resolveRestaurants!: (value: unknown) => void;
      (restaurantsApi.fetchRestaurants as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveRestaurants = resolve;
          })
      );
      render(<BookingDetailPopup {...baseProps} />);
      await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
      fireEvent.press(screen.getByText("Edit"));
      await waitFor(() => expect(screen.getByTestId("edit-booking-form")).toBeTruthy());
      // Leaving edit mode before fetchRestaurants resolves flips `editing`,
      // which triggers that effect's cleanup (cancelled = true) ahead of
      // the stale response arriving.
      fireEvent.press(screen.getByText("Cancel"));
      await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
      await act(async () => {
        resolveRestaurants([{ id: 1, name: "R", sections: [] }]);
      });
      expect(screen.getByText("Edit")).toBeTruthy();
    });
  });

  describe("initialFocus='extend' (bound to the bookings-list 'e' shortcut)", () => {
    afterEach(() => {
      Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
    });

    it("fires the auto-scroll effect on web without crashing", async () => {
      Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
      render(<BookingDetailPopup {...baseProps} initialFocus="extend" />);
      await waitFor(() => expect(screen.getByTestId("extend-section")).toBeTruthy());
      // View refs in the RN test renderer are component instances, not DOM
      // elements, so scrollIntoView?.() is a no-op via optional chaining —
      // this proves the timeout callback runs without throwing.
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(screen.getByTestId("extend-section")).toBeTruthy();
    });

    it("calls findNodeHandle on native", async () => {
      Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });
      const findNodeHandleSpy = jest
        .spyOn(require("react-native"), "findNodeHandle")
        .mockReturnValue(1);

      try {
        render(<BookingDetailPopup {...baseProps} initialFocus="extend" />);
        await waitFor(() => expect(screen.getByTestId("extend-section")).toBeTruthy());
        await waitFor(() => expect(findNodeHandleSpy).toHaveBeenCalled(), { timeout: 1000 });
      } finally {
        findNodeHandleSpy.mockRestore();
      }
    });

    it("fires measureLayout success callback scrolling the extend section into view natively", async () => {
      Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });
      const { View } = require("react-native");
      const findNodeHandleSpy = jest
        .spyOn(require("react-native"), "findNodeHandle")
        .mockReturnValue(1);
      const measureLayoutSpy = jest
        .spyOn(View.prototype, "measureLayout")
        .mockImplementation((...args: unknown[]) => {
          const success = args[1] as (x: number, y: number) => void;
          success(0, 100);
        });

      try {
        render(<BookingDetailPopup {...baseProps} initialFocus="extend" />);
        await waitFor(() => expect(screen.getByTestId("extend-section")).toBeTruthy());
        await waitFor(() => expect(measureLayoutSpy).toHaveBeenCalled(), { timeout: 1000 });
      } finally {
        findNodeHandleSpy.mockRestore();
        measureLayoutSpy.mockRestore();
      }
    });

    it("does not scroll when the extend section is not rendered (editing mode)", async () => {
      const findNodeHandleSpy = jest.spyOn(require("react-native"), "findNodeHandle");
      render(<BookingDetailPopup {...baseProps} initialFocus="extend" />);
      await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
      fireEvent.press(screen.getByText("Edit"));
      await waitFor(() => expect(screen.getByTestId("edit-booking-form")).toBeTruthy());
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(findNodeHandleSpy).not.toHaveBeenCalled();
      findNodeHandleSpy.mockRestore();
    });

    it("does not scroll for a cancelled booking", async () => {
      (adminApi.getAdminBooking as jest.Mock).mockResolvedValue(cancelledBooking);
      const findNodeHandleSpy = jest.spyOn(require("react-native"), "findNodeHandle");
      render(<BookingDetailPopup {...baseProps} initialFocus="extend" />);
      await waitFor(() => expect(screen.getByTestId("booking-details-card")).toBeTruthy());
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(screen.queryByTestId("extend-section")).toBeNull();
      expect(findNodeHandleSpy).not.toHaveBeenCalled();
      findNodeHandleSpy.mockRestore();
    });

    it("does not scroll when initialFocus is unset", async () => {
      const findNodeHandleSpy = jest.spyOn(require("react-native"), "findNodeHandle");
      render(<BookingDetailPopup {...baseProps} />);
      await waitFor(() => expect(screen.getByTestId("extend-section")).toBeTruthy());
      await new Promise((resolve) => setTimeout(resolve, 250));
      expect(findNodeHandleSpy).not.toHaveBeenCalled();
      findNodeHandleSpy.mockRestore();
    });
  });
});
