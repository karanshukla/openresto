import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { BookingDetailPopup } from "@/components/admin/bookings/BookingDetailPopup";

jest.mock("@/context/BrandContext", () => ({
  useBrand: jest.fn().mockReturnValue({ primaryColor: "#007AFF", appName: "Test" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text testID={`icon-${name}`}>{name}</Text>,
  };
});

const mockBooking = {
  id: 42,
  restaurantId: 1,
  restaurantName: "Test Restaurant",
  sectionId: 10,
  sectionName: "Main Floor",
  tableId: 100,
  tableName: "T1",
  date: new Date("2026-06-15T19:00:00").toISOString(),
  endTime: new Date("2026-06-15T21:00:00").toISOString(),
  customerEmail: "guest@example.com",
  seats: 2,
  specialRequests: "Window seat",
  bookingRef: "ABC-123",
  isCancelled: false,
};

jest.mock("@/api/admin", () => ({
  getAdminBooking: jest.fn().mockResolvedValue(null),
  adminDeleteBooking: jest.fn().mockResolvedValue(true),
  adminExtendBooking: jest.fn().mockResolvedValue({ endTime: "2026-06-15T22:00:00Z" }),
  adminPurgeBooking: jest.fn().mockResolvedValue(true),
  sendBookingEmail: jest.fn().mockResolvedValue({ ok: true, message: "Email sent." }),
  adminRestoreBooking: jest.fn().mockResolvedValue(undefined),
  adminUpdateBookingFull: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/api/restaurants", () => ({
  fetchRestaurants: jest.fn().mockResolvedValue([
    {
      id: 1,
      name: "Test Restaurant",
      sections: [
        { id: 10, name: "Main Floor", tables: [{ id: 100, name: "T1", seats: 4 }] },
      ],
    },
  ]),
}));

// Mock sub-components to simplify
jest.mock("@/components/admin/bookings/BookingDetailsCard", () => ({
  BookingDetailsCard: ({ booking }: any) => {
    const { Text } = require("react-native");
    return <Text>{booking.customerEmail}</Text>;
  },
}));

jest.mock("@/components/admin/bookings/EditBookingForm", () => ({
  EditBookingForm: ({
    handleRestaurantChange,
    handleSectionChange,
    setEditSeats,
    setEditDate,
    setEditTime,
  }: any) => {
    const { TouchableOpacity, Text } = require("react-native");
    return (
      <>
        <Text>Edit Form</Text>
        <TouchableOpacity onPress={() => handleRestaurantChange(1)} testID="change-restaurant">
          <Text>Change Restaurant</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleSectionChange(10)} testID="change-section">
          <Text>Change Section</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setEditSeats("abc")} testID="set-invalid-seats">
          <Text>Set Invalid Seats</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setEditSeats("5")} testID="set-high-seats">
          <Text>Set High Seats</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setEditDate("")} testID="clear-date">
          <Text>Clear Date</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setEditTime("")} testID="clear-time">
          <Text>Clear Time</Text>
        </TouchableOpacity>
      </>
    );
  },
}));

jest.mock("@/components/admin/bookings/ExtendBookingActions", () => ({
  ExtendBookingActions: ({ onExtend }: any) => {
    const { TouchableOpacity, Text } = require("react-native");
    return (
      <TouchableOpacity onPress={() => onExtend(30)} testID="extend-30">
        <Text>Extend 30</Text>
      </TouchableOpacity>
    );
  },
}));

jest.mock("@/components/admin/bookings/EmailGuestForm", () => ({
  EmailGuestForm: ({ onSendEmail, setEmailSubject, setEmailBody }: any) => {
    const { View, TouchableOpacity, Text, TextInput } = require("react-native");
    return (
      <View>
        <TextInput
          testID="email-subject"
          onChangeText={setEmailSubject}
          placeholder="Subject"
        />
        <TextInput
          testID="email-body"
          onChangeText={setEmailBody}
          placeholder="Body"
        />
        <TouchableOpacity onPress={onSendEmail} testID="send-email-btn">
          <Text>Send</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

jest.mock("@/components/admin/bookings/BookingActionButtons", () => ({
  BookingActionButtons: ({ isCancelled, onUncancel, onCancel, onPurge }: any) => {
    const { View, TouchableOpacity, Text } = require("react-native");
    return (
      <View>
        {isCancelled ? (
          <TouchableOpacity onPress={onUncancel} testID="restore-btn">
            <Text>Restore</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onCancel} testID="cancel-btn">
            <Text>Cancel Booking</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onPurge} testID="purge-btn">
          <Text>Purge</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

jest.mock("@/components/common/ConfirmModal", () => {
  const { View, TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ visible, title, onConfirm, onCancel }: any) =>
      visible ? (
        <View testID="confirm-modal">
          <Text>{title}</Text>
          <TouchableOpacity onPress={onConfirm} testID="confirm-btn">
            <Text>Confirm</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} testID="cancel-modal-btn">
            <Text>Cancel Modal</Text>
          </TouchableOpacity>
        </View>
      ) : null,
  };
});

jest.mock("@/components/common/AlertModal", () => {
  const { View, TouchableOpacity, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ visible, message, onClose }: any) =>
      visible ? (
        <View testID="alert-modal">
          <Text>{message}</Text>
          <TouchableOpacity onPress={onClose} testID="alert-close-btn">
            <Text>Close Alert</Text>
          </TouchableOpacity>
        </View>
      ) : null,
  };
});

describe("BookingDetailPopup", () => {
  const defaultProps = {
    bookingId: null,
    onClose: jest.fn(),
    onDeleted: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const adminApi = require("@/api/admin");
    adminApi.getAdminBooking.mockResolvedValue(mockBooking);
  });

  it("renders nothing visible when bookingId is null", () => {
    render(<BookingDetailPopup {...defaultProps} bookingId={null} />);
    expect(screen.queryByText("Booking Details")).toBeNull();
  });

  it("shows Booking Details header when bookingId is set", async () => {
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => {
      expect(screen.getByText("Booking Details")).toBeTruthy();
    });
  });

  it("shows loading state initially then booking data", async () => {
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => {
      expect(screen.getByText("guest@example.com")).toBeTruthy();
    });
  });

  it("shows Booking not found when booking is null", async () => {
    const adminApi = require("@/api/admin");
    adminApi.getAdminBooking.mockResolvedValue(null);
    render(<BookingDetailPopup {...defaultProps} bookingId={99} />);
    await waitFor(() => {
      expect(screen.getByText("Booking not found.")).toBeTruthy();
    });
  });

  it("calls onClose when backdrop is pressed", async () => {
    const onClose = jest.fn();
    render(<BookingDetailPopup {...defaultProps} bookingId={42} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText("Booking Details")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("icon-close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("enters edit mode when Edit button pressed", async () => {
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => {
      expect(screen.getByText("Edit")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => {
      expect(screen.getByText("Edit Form")).toBeTruthy();
    });
  });

  it("cancels edit mode when Cancel is pressed", async () => {
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => {
      expect(screen.getByText("Edit")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => {
      expect(screen.getByText("Cancel")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() => {
      expect(screen.getByText("guest@example.com")).toBeTruthy();
    });
  });

  it("saves edit when Save Changes is pressed", async () => {
    const adminApi = require("@/api/admin");
    adminApi.adminUpdateBookingFull.mockResolvedValue({ ...mockBooking, seats: 3 });
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => {
      expect(screen.getByText("Edit")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => {
      expect(screen.getByText("Save Changes")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Save Changes"));
    await waitFor(() => {
      expect(adminApi.adminUpdateBookingFull).toHaveBeenCalled();
    });
  });

  it("shows error when save changes returns null", async () => {
    const adminApi = require("@/api/admin");
    adminApi.adminUpdateBookingFull.mockRejectedValue(new Error("Save failed"));
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => {
      expect(screen.getByText("Edit")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => {
      expect(screen.getByText("Save Changes")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Save Changes"));
    await waitFor(() => {
      expect(screen.getByText("Save failed")).toBeTruthy();
    });
  });

  it("shows cancel confirm modal when Cancel Booking is pressed", async () => {
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => {
      expect(screen.getByTestId("cancel-btn")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("cancel-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("confirm-modal")).toBeTruthy();
    });
  });

  it("deletes booking when cancel is confirmed", async () => {
    const adminApi = require("@/api/admin");
    const onDeleted = jest.fn();
    const onClose = jest.fn();
    render(<BookingDetailPopup {...defaultProps} bookingId={42} onDeleted={onDeleted} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByTestId("cancel-btn")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("cancel-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("confirm-btn")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("confirm-btn"));
    await waitFor(() => {
      expect(adminApi.adminDeleteBooking).toHaveBeenCalledWith(42);
      expect(onDeleted).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("shows error when delete booking fails", async () => {
    const adminApi = require("@/api/admin");
    adminApi.adminDeleteBooking.mockResolvedValue(false);
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => {
      expect(screen.getByTestId("cancel-btn")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("cancel-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("confirm-btn")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("confirm-btn"));
    await waitFor(() => {
      expect(screen.getByText("Failed to cancel the booking.")).toBeTruthy();
    });
  });

  it("shows purge confirm modal when Purge is pressed", async () => {
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => {
      expect(screen.getByTestId("purge-btn")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("purge-btn"));
    await waitFor(() => {
      expect(screen.getByText("Permanently Delete")).toBeTruthy();
    });
  });

  it("purges booking when purge is confirmed", async () => {
    const adminApi = require("@/api/admin");
    const onDeleted = jest.fn();
    const onClose = jest.fn();
    render(<BookingDetailPopup {...defaultProps} bookingId={42} onDeleted={onDeleted} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByTestId("purge-btn")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("purge-btn"));
    await waitFor(() => {
      expect(screen.getByText("Permanently Delete")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("confirm-btn"));
    await waitFor(() => {
      expect(adminApi.adminPurgeBooking).toHaveBeenCalledWith(42);
      expect(onDeleted).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("shows error when purge fails", async () => {
    const adminApi = require("@/api/admin");
    adminApi.adminPurgeBooking.mockResolvedValue(false);
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => {
      expect(screen.getByTestId("purge-btn")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("purge-btn"));
    fireEvent.press(screen.getByTestId("confirm-btn"));
    await waitFor(() => {
      expect(screen.getByText("Failed to permanently delete the booking.")).toBeTruthy();
    });
  });

  it("shows restore confirm for cancelled booking", async () => {
    const adminApi = require("@/api/admin");
    adminApi.getAdminBooking.mockResolvedValue({ ...mockBooking, isCancelled: true });
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => {
      expect(screen.getByTestId("restore-btn")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("restore-btn"));
    await waitFor(() => {
      expect(screen.getByText("Restore Booking")).toBeTruthy();
    });
  });

  it("restores booking when confirmed", async () => {
    const adminApi = require("@/api/admin");
    adminApi.getAdminBooking.mockResolvedValue({ ...mockBooking, isCancelled: true });
    adminApi.adminRestoreBooking.mockResolvedValue(undefined);
    adminApi.getAdminBooking.mockResolvedValueOnce({ ...mockBooking, isCancelled: true });
    adminApi.getAdminBooking.mockResolvedValueOnce({ ...mockBooking, isCancelled: false });
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => {
      expect(screen.getByTestId("restore-btn")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("restore-btn"));
    await waitFor(() => {
      expect(screen.getByText("Restore Booking")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("confirm-btn"));
    await waitFor(() => {
      expect(adminApi.adminRestoreBooking).toHaveBeenCalledWith(42);
    });
  });

  it("handles restore error gracefully", async () => {
    const adminApi = require("@/api/admin");
    adminApi.getAdminBooking.mockResolvedValue({ ...mockBooking, isCancelled: true });
    adminApi.adminRestoreBooking.mockRejectedValue(new Error("Restore failed"));
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => {
      expect(screen.getByTestId("restore-btn")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("restore-btn"));
    fireEvent.press(screen.getByTestId("confirm-btn"));
    await waitFor(() => {
      expect(screen.getByText("Restore failed")).toBeTruthy();
    });
  });

  it("extends booking when extend action is triggered", async () => {
    const adminApi = require("@/api/admin");
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => {
      expect(screen.getByTestId("extend-30")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("extend-30"));
    await waitFor(() => {
      expect(adminApi.adminExtendBooking).toHaveBeenCalledWith(42, 30);
    });
  });

  it("dismisses error modal when close is pressed", async () => {
    const adminApi = require("@/api/admin");
    adminApi.adminDeleteBooking.mockResolvedValue(false);
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => {
      expect(screen.getByTestId("cancel-btn")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("cancel-btn"));
    fireEvent.press(screen.getByTestId("confirm-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("alert-close-btn")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("alert-close-btn"));
    await waitFor(() => {
      expect(screen.queryByTestId("alert-modal")).toBeNull();
    });
  });

  it("cancels delete confirm modal when cancel is pressed", async () => {
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => {
      expect(screen.getByTestId("cancel-btn")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("cancel-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("confirm-modal")).toBeTruthy();
    });
    fireEvent.press(screen.getByTestId("cancel-modal-btn"));
    await waitFor(() => {
      expect(screen.queryByTestId("confirm-modal")).toBeNull();
    });
  });

  it("resets state when bookingId becomes null", async () => {
    const { rerender } = render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => {
      expect(screen.getByText("Booking Details")).toBeTruthy();
    });
    rerender(<BookingDetailPopup {...defaultProps} bookingId={null} />);
    await waitFor(() => {
      expect(screen.queryByText("Booking Details")).toBeNull();
    });
  });

  it("calls handleRestaurantChange when restaurant changes in edit form", async () => {
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => expect(screen.getByTestId("change-restaurant")).toBeTruthy());
    fireEvent.press(screen.getByTestId("change-restaurant"));
    expect(screen.getByText("Edit Form")).toBeTruthy();
  });

  it("calls handleSectionChange when section changes in edit form", async () => {
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => expect(screen.getByTestId("change-section")).toBeTruthy());
    fireEvent.press(screen.getByTestId("change-section"));
    expect(screen.getByText("Edit Form")).toBeTruthy();
  });

  it("shows error for invalid seats in handleSaveEdit", async () => {
    const adminApi = require("@/api/admin");
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => expect(screen.getByTestId("set-invalid-seats")).toBeTruthy());
    fireEvent.press(screen.getByTestId("set-invalid-seats"));
    fireEvent.press(screen.getByText("Save Changes"));
    await waitFor(() => {
      expect(screen.getByText("Invalid seats value")).toBeTruthy();
    });
    expect(adminApi.adminUpdateBookingFull).not.toHaveBeenCalled();
  });

  it("shows error for missing date in handleSaveEdit", async () => {
    const adminApi = require("@/api/admin");
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => expect(screen.getByTestId("clear-date")).toBeTruthy());
    fireEvent.press(screen.getByTestId("clear-date"));
    fireEvent.press(screen.getByText("Save Changes"));
    await waitFor(() => {
      expect(screen.getByText("Date and time are required")).toBeTruthy();
    });
    expect(adminApi.adminUpdateBookingFull).not.toHaveBeenCalled();
  });

  it("shows capacity warning and cancels save when user declines", async () => {
    delete (window as any).confirm;
    (window as any).confirm = jest.fn(() => false);
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => expect(screen.getByTestId("set-high-seats")).toBeTruthy());
    fireEvent.press(screen.getByTestId("set-high-seats"));
    fireEvent.press(screen.getByText("Save Changes"));
    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
    });
    const adminApi = require("@/api/admin");
    expect(adminApi.adminUpdateBookingFull).not.toHaveBeenCalled();
  });

  it("proceeds with save when user confirms capacity warning", async () => {
    delete (window as any).confirm;
    (window as any).confirm = jest.fn(() => true);
    const adminApi = require("@/api/admin");
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => expect(screen.getByText("Edit")).toBeTruthy());
    fireEvent.press(screen.getByText("Edit"));
    await waitFor(() => expect(screen.getByTestId("set-high-seats")).toBeTruthy());
    fireEvent.press(screen.getByTestId("set-high-seats"));
    fireEvent.press(screen.getByText("Save Changes"));
    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(adminApi.adminUpdateBookingFull).toHaveBeenCalled();
    });
  });

  it("sends email when subject and body are filled", async () => {
    const adminApi = require("@/api/admin");
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => expect(screen.getByTestId("email-subject")).toBeTruthy());
    fireEvent.changeText(screen.getByTestId("email-subject"), "Test Subject");
    fireEvent.changeText(screen.getByTestId("email-body"), "Test Body");
    fireEvent.press(screen.getByTestId("send-email-btn"));
    await waitFor(() => {
      expect(adminApi.sendBookingEmail).toHaveBeenCalledWith(42, "Test Subject", "Test Body");
    });
  });

  it("does not send email when subject or body is empty", async () => {
    const adminApi = require("@/api/admin");
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => expect(screen.getByTestId("send-email-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("send-email-btn"));
    await new Promise((r) => setTimeout(r, 50));
    expect(adminApi.sendBookingEmail).not.toHaveBeenCalled();
  });

  it("cancels restore confirm modal when cancel is pressed", async () => {
    const adminApi = require("@/api/admin");
    adminApi.getAdminBooking.mockResolvedValue({ ...mockBooking, isCancelled: true });
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => expect(screen.getByTestId("restore-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("restore-btn"));
    await waitFor(() => expect(screen.getByText("Restore Booking")).toBeTruthy());
    fireEvent.press(screen.getByTestId("cancel-modal-btn"));
    await waitFor(() => {
      expect(screen.queryByText("Restore Booking")).toBeNull();
    });
  });

  it("cancels purge confirm modal when cancel is pressed", async () => {
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => expect(screen.getByTestId("purge-btn")).toBeTruthy());
    fireEvent.press(screen.getByTestId("purge-btn"));
    await waitFor(() => expect(screen.getByText("Permanently Delete")).toBeTruthy());
    fireEvent.press(screen.getByTestId("cancel-modal-btn"));
    await waitFor(() => {
      expect(screen.queryByText("Permanently Delete")).toBeNull();
    });
  });

  it("inner modal Pressable stops propagation when pressed", async () => {
    render(<BookingDetailPopup {...defaultProps} bookingId={42} />);
    await waitFor(() => expect(screen.getByText("guest@example.com")).toBeTruthy());
    // Find the inner Pressable by its stopPropagation handler using UNSAFE_getAllByProps
    const { UNSAFE_getAllByProps } = screen as any;
    if (typeof UNSAFE_getAllByProps === "function") {
      const pressables = UNSAFE_getAllByProps({ accessible: true });
      const innerModal = pressables.find((el: any) => {
        const style = el.props.style;
        const s = Array.isArray(style) ? style : [style];
        return s.some((item: any) => item && item.width === "92%");
      });
      if (innerModal) {
        fireEvent(innerModal, "press", { stopPropagation: jest.fn() });
      }
    }
    expect(screen.getByText("guest@example.com")).toBeTruthy();
  });
});
