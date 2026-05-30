/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react-native";
import BookingDetailScreen from "@/app/(admin)/bookings/[id]";
import {
  getAdminBooking,
  adminDeleteBooking,
  adminExtendBooking,
  adminRestoreBooking,
  adminPurgeBooking,
  adminUpdateBookingFull,
  sendBookingEmail,
} from "@/api/admin";
import { fetchRestaurants } from "@/api/restaurants";
import { AppThemeProvider } from "@/context/ThemeContext";
import { BrandProvider } from "@/context/BrandContext";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Polyfill fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
  })
) as jest.Mock;

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(() => ({ id: "10" })),
  useRouter: () => ({ back: mockBack }),
  Stack: { Screen: () => null },
}));

jest.mock("@/api/admin");
jest.mock("@/api/restaurants");
jest.mock("@/api/availability", () => ({ fetchAvailability: jest.fn() }));

// Mock Modal and window.confirm
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  // Mock ActivityIndicator with testID
  rn.ActivityIndicator = (props: any) => <rn.View {...props} testID="loading-indicator" />;
  rn.Modal = ({ children, visible }: any) => (visible ? children : null);
  return rn;
});

jest.mock("@/components/admin/bookings/EditBookingForm", () => {
  const { View, Text } = require("react-native");
  return {
    EditBookingForm: () => (
      <View>
        <Text>Edit Form</Text>
      </View>
    ),
  };
});

// Mock sub-components if they cause string fragmentation
jest.mock("@/components/admin/bookings/ExtendBookingActions", () => {
  const { View, Pressable, Text } = require("react-native");
  return {
    ExtendBookingActions: ({ onExtend }: any) => (
      <View>
        <Pressable testID="extend-30" onPress={() => onExtend(30)}>
          <Text>+30m</Text>
        </Pressable>
      </View>
    ),
  };
});

jest.setTimeout(20000);

describe("BookingDetailScreen", () => {
  const mockBooking = {
    id: 10,
    bookingRef: "REF123",
    customerEmail: "test@test.com",
    restaurantId: 1,
    sectionId: 1,
    tableId: 1,
    date: "2026-10-10T12:00:00Z",
    seats: 2,
    isCancelled: false,
    tableName: "T1",
  };

  const mockRestaurants = [
    {
      id: 1,
      name: "Resto A",
      sections: [{ id: 1, name: "S1", tables: [{ id: 1, name: "T1", seats: 4 }] }],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (getAdminBooking as jest.Mock).mockResolvedValue(mockBooking);
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    delete (window as any).confirm;
    (window as any).confirm = jest.fn(() => true);
  });

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 0, height: 0 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <AppThemeProvider>
          <BrandProvider>{ui}</BrandProvider>
        </AppThemeProvider>
      </SafeAreaProvider>
    );
  };

  it("renders booking details after loading", async () => {
    renderWithProviders(<BookingDetailScreen />);
    // Wait for the indicator to disappear
    await waitFor(() => expect(screen.queryByTestId("loading-indicator")).toBeNull(), {
      timeout: 5000,
    });
    // Verify email and ref
    expect(screen.getAllByText(/test@test.com/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/REF123/i)).toBeTruthy();
  });

  it("handles uncancel flow", async () => {
    (getAdminBooking as jest.Mock).mockResolvedValue({ ...mockBooking, isCancelled: true });
    (adminRestoreBooking as jest.Mock).mockResolvedValue(true);

    renderWithProviders(<BookingDetailScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-indicator")).toBeNull());

    const restoreBtn = await screen.findByText("Restore Booking");
    fireEvent.press(restoreBtn);

    const confirmRestoreBtn = screen.getByText("Restore");
    fireEvent.press(confirmRestoreBtn);

    await waitFor(() => expect(adminRestoreBooking).toHaveBeenCalledWith(10));
  });

  it("handles extension flow", async () => {
    (adminExtendBooking as jest.Mock).mockResolvedValue({ endTime: "new-time" });
    renderWithProviders(<BookingDetailScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-indicator")).toBeNull());

    const extendBtn = await screen.findByTestId("extend-30");
    fireEvent.press(extendBtn);
    await waitFor(() => expect(adminExtendBooking).toHaveBeenCalledWith(10, 30));
  });

  it("handles delete (cancel) flow", async () => {
    (adminDeleteBooking as jest.Mock).mockResolvedValue(true);
    renderWithProviders(<BookingDetailScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-indicator")).toBeNull());

    const cancelBtn = await screen.findByText("Cancel Booking");
    fireEvent.press(cancelBtn);

    const btns = screen.getAllByText("Cancel Booking");
    fireEvent.press(btns[btns.length - 1]);

    await waitFor(() => expect(adminDeleteBooking).toHaveBeenCalledWith(10));
    expect(mockBack).toHaveBeenCalled();
  });

  it("shows Booking not found when booking is null", async () => {
    (getAdminBooking as jest.Mock).mockResolvedValue(null);
    renderWithProviders(<BookingDetailScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-indicator")).toBeNull(), {
      timeout: 5000,
    });
    expect(screen.getByText("Booking not found.")).toBeTruthy();
  });

  it("enters edit mode showing Cancel and Save Changes", async () => {
    renderWithProviders(<BookingDetailScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-indicator")).toBeNull(), {
      timeout: 5000,
    });
    fireEvent.press(await screen.findByText("Edit Booking"));
    expect(screen.getByText("Cancel")).toBeTruthy();
    expect(screen.getByText("Save Changes")).toBeTruthy();
  });

  it("exits edit mode on Cancel press", async () => {
    renderWithProviders(<BookingDetailScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-indicator")).toBeNull(), {
      timeout: 5000,
    });
    fireEvent.press(await screen.findByText("Edit Booking"));
    fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() => expect(screen.getByText("Edit Booking")).toBeTruthy());
  });

  it("calls adminUpdateBookingFull on Save Changes", async () => {
    (adminUpdateBookingFull as jest.Mock).mockResolvedValue({ ...mockBooking });
    renderWithProviders(<BookingDetailScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-indicator")).toBeNull(), {
      timeout: 5000,
    });
    await act(async () => {
      fireEvent.press(await screen.findByText("Edit Booking"));
    });
    await act(async () => {});
    await act(async () => {
      fireEvent.press(screen.getByText("Save Changes"));
    });
    await waitFor(() =>
      expect(adminUpdateBookingFull).toHaveBeenCalledWith(10, expect.any(Object))
    );
  });

  it("shows error when save edit fails", async () => {
    (adminUpdateBookingFull as jest.Mock).mockRejectedValue(new Error("Update failed"));
    (fetchRestaurants as jest.Mock).mockResolvedValue(mockRestaurants);
    renderWithProviders(<BookingDetailScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-indicator")).toBeNull());

    fireEvent.press(await screen.findByText("Edit Booking"));
    await waitFor(() => expect(screen.getByText("Save Changes")).toBeTruthy());

    fireEvent.press(screen.getByText("Save Changes"));
    await waitFor(() => expect(screen.getByText("Update failed")).toBeTruthy());
  });

  it("shows error when adminDeleteBooking fails", async () => {
    (adminDeleteBooking as jest.Mock).mockResolvedValue(false);
    renderWithProviders(<BookingDetailScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-indicator")).toBeNull(), {
      timeout: 5000,
    });
    fireEvent.press(await screen.findByText("Cancel Booking"));
    const btns = screen.getAllByText("Cancel Booking");
    fireEvent.press(btns[btns.length - 1]);
    await waitFor(() => expect(screen.getByText("Failed to cancel the booking.")).toBeTruthy());
  });

  it("handles purge flow successfully", async () => {
    (adminPurgeBooking as jest.Mock).mockResolvedValue(true);
    renderWithProviders(<BookingDetailScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-indicator")).toBeNull(), {
      timeout: 5000,
    });
    fireEvent.press(await screen.findByText("Permanently Delete (GDPR)"));
    fireEvent.press(screen.getByText("Delete Forever"));
    await waitFor(() => expect(adminPurgeBooking).toHaveBeenCalledWith(10));
    expect(mockBack).toHaveBeenCalled();
  });

  it("shows error when purge fails", async () => {
    (adminPurgeBooking as jest.Mock).mockResolvedValue(false);
    renderWithProviders(<BookingDetailScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-indicator")).toBeNull());

    fireEvent.press(await screen.findByText("Permanently Delete (GDPR)"));
    fireEvent.press(await screen.findByText("Delete Forever"));

    await waitFor(() =>
      expect(screen.getByText("Failed to permanently delete the booking.")).toBeTruthy()
    );
  });

  it("renders EmailGuestForm when booking is not cancelled", async () => {
    renderWithProviders(<BookingDetailScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-indicator")).toBeNull());
    expect(await screen.findByText("Email guest")).toBeTruthy();
    expect(screen.getByText("Send Email")).toBeTruthy();
  });

  it("shows error when uncancel throws", async () => {
    (getAdminBooking as jest.Mock).mockResolvedValue({ ...mockBooking, isCancelled: true });
    (adminRestoreBooking as jest.Mock).mockRejectedValue(new Error("Restore failed"));
    renderWithProviders(<BookingDetailScreen />);
    await waitFor(() => expect(screen.queryByTestId("loading-indicator")).toBeNull());

    fireEvent.press(await screen.findByText("Restore Booking"));
    fireEvent.press(screen.getByText("Restore"));

    await waitFor(() => expect(screen.getByText("Restore failed")).toBeTruthy());
  });
});
