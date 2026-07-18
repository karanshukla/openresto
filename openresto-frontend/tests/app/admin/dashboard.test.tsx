/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react-native";
import AdminDashboardScreen from "@/app/admin/dashboard";
import { getAdminDashboardStats, AdminDashboardStats } from "@/api/admin";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

jest.mock("@/api/admin");
jest.mock("@/components/admin/bookings/RestaurantActionModal", () => {
  const { View, Pressable, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ visible, onClose, onSuccess }: any) => {
      if (!visible) return null;
      return (
        <View testID="action-modal">
          <Pressable testID="action-modal-close" onPress={onClose}>
            <Text>Close Action Modal</Text>
          </Pressable>
          <Pressable testID="action-modal-success" onPress={() => onSuccess("Action succeeded")}>
            <Text>Action Done</Text>
          </Pressable>
        </View>
      );
    },
  };
});
jest.mock("@/components/admin/bookings/BookingDetailPopup", () => {
  const { View, Pressable, Text } = require("react-native");
  return {
    BookingDetailPopup: ({ bookingId, onClose, onMutated }: any) => {
      if (!bookingId) return null;
      return (
        <View testID="booking-detail-popup">
          <Pressable testID="booking-popup-close" onPress={onClose}>
            <Text>Close Popup</Text>
          </Pressable>
          <Pressable testID="booking-popup-mutate" onPress={onMutated}>
            <Text>Mutate Booking</Text>
          </Pressable>
        </View>
      );
    },
  };
});
jest.mock("@/components/common/AlertModal", () => {
  const { View, Pressable, Text } = require("react-native");
  return {
    __esModule: true,
    default: ({ visible, onClose, message }: any) => {
      if (!visible) return null;
      return (
        <View testID="alert-modal">
          <Text>{message}</Text>
          <Pressable testID="alert-modal-close" onPress={onClose}>
            <Text>Close Alert</Text>
          </Pressable>
        </View>
      );
    },
  };
});
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  Stack: { Screen: () => null },
}));

const mockStats: AdminDashboardStats = {
  todayCount: 5,
  activeHoldsCount: 3,
  pausedCount: 1,
  totalCovers: 100,
  occupancyData: [10, 20, 30, 40, 50, 60, 70],
  occupancyCounts: [1, 2, 3, 4, 5, 6, 12],
  occupancyDates: Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  }),
  recentBookings: [
    {
      id: 10,
      date: new Date().toISOString(),
      seats: 4,
      customerEmail: "today@test.com",
      restaurantName: "Resto A",
      bookingRef: "ABC123",
    },
  ],
};

jest.setTimeout(15000);

describe("AdminDashboardScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAdminDashboardStats as jest.Mock).mockResolvedValue(mockStats);
  });

  it("renders metrics and recent bookings after loading", async () => {
    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);

    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());

    expect(screen.getByText("today@test.com")).toBeTruthy();
    // "5" appears both as the Today's Bookings metric and as an occupancy count label,
    // so assert presence (not uniqueness) here.
    expect(screen.getAllByText("5").length).toBeGreaterThan(0);
    expect(screen.getByText("1 venues are currently paused")).toBeTruthy();
    expect(screen.getByText("100")).toBeTruthy();
  });

  it("renders empty state when there are no recent bookings", async () => {
    (getAdminDashboardStats as jest.Mock).mockResolvedValue({
      ...mockStats,
      recentBookings: [],
    });

    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);

    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());

    expect(screen.getByText("No upcoming bookings for today.")).toBeTruthy();
  });

  it("navigates to bookings list on View all press", async () => {
    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());
    await waitFor(() => screen.getByText("View all →"));

    fireEvent.press(screen.getByText("View all →"));

    expect(mockPush).toHaveBeenCalledWith("/admin/bookings");
  });

  it("shows Seated badge for a currently in-progress booking (via StatusBadge)", async () => {
    const now = Date.now();
    (getAdminDashboardStats as jest.Mock).mockResolvedValue({
      ...mockStats,
      recentBookings: [
        {
          id: 1,
          // started 30 min ago → diffMins = -30 → StatusBadge renders "Seated"
          date: new Date(now - 30 * 60 * 1000).toISOString(),
          endTime: new Date(now + 30 * 60 * 1000).toISOString(),
          seats: 2,
          customerEmail: "active@test.com",
          restaurantName: "Resto A",
          bookingRef: "X1",
          isCancelled: false,
        },
      ],
    });

    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());

    expect(screen.getByText("Seated")).toBeTruthy();
  });

  it("shows Scheduled badge for a future booking (via StatusBadge)", async () => {
    const now = Date.now();
    (getAdminDashboardStats as jest.Mock).mockResolvedValue({
      ...mockStats,
      recentBookings: [
        {
          id: 2,
          // starts in 2 hours → diffMins = 120 → StatusBadge renders "Scheduled"
          date: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
          seats: 2,
          customerEmail: "upcoming@test.com",
          restaurantName: "Resto A",
          bookingRef: "X2",
          isCancelled: false,
        },
      ],
    });

    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());

    expect(screen.getByText("Scheduled")).toBeTruthy();
  });

  it("shows Cancelled badge for a cancelled booking", async () => {
    const now = Date.now();
    (getAdminDashboardStats as jest.Mock).mockResolvedValue({
      ...mockStats,
      recentBookings: [
        {
          id: 3,
          date: new Date(now + 60 * 60 * 1000).toISOString(),
          seats: 2,
          customerEmail: "cancelled@test.com",
          restaurantName: "Resto A",
          bookingRef: "X3",
          isCancelled: true,
        },
      ],
    });

    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());

    expect(screen.getByText("Cancelled")).toBeTruthy();
  });

  it("shows Completed badge for a past booking (via StatusBadge)", async () => {
    const now = Date.now();
    (getAdminDashboardStats as jest.Mock).mockResolvedValue({
      ...mockStats,
      recentBookings: [
        {
          id: 4,
          // started 3 hours ago → diffMins = -180 → StatusBadge renders "Completed"
          date: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
          endTime: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
          seats: 2,
          customerEmail: "past@test.com",
          restaurantName: "Resto A",
          bookingRef: "X4",
          isCancelled: false,
        },
      ],
    });

    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());

    expect(screen.getByText("Completed")).toBeTruthy();
    expect(screen.queryByText("Cancelled")).toBeNull();
  });

  it("navigates to quick action routes", async () => {
    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());
    await waitFor(() => screen.getByText("New Booking"));

    fireEvent.press(screen.getByText("New Booking"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/admin/bookings",
      params: { create: "1" },
    });

    fireEvent.press(screen.getByText("Manage Settings"));
    expect(mockPush).toHaveBeenCalledWith("/admin/settings");
  });

  it("navigates to bookings list on View All Bookings press", async () => {
    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());
    await waitFor(() => screen.getByText("View All Bookings"));

    fireEvent.press(screen.getByText("View All Bookings"));

    expect(mockPush).toHaveBeenCalledWith("/admin/bookings");
  });

  it("does not crash or navigate on Pause Bookings press", async () => {
    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());
    await waitFor(() => screen.getByText("Pause Bookings"));

    fireEvent.press(screen.getByText("Pause Bookings"));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does not crash or navigate on Extend Bookings press", async () => {
    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());
    await waitFor(() => screen.getByText("Extend Bookings"));

    fireEvent.press(screen.getByText("Extend Bookings"));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("does not crash when pressing a booking item", async () => {
    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());
    await waitFor(() => screen.getByText("today@test.com"));

    expect(() => fireEvent.press(screen.getByText("today@test.com"))).not.toThrow();
  });

  it("does not crash when stats resolves to null", async () => {
    (getAdminDashboardStats as jest.Mock).mockResolvedValue(null);

    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);

    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());
  });

  it("calls RestaurantActionModal onClose callback (line 239)", async () => {
    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());
    await waitFor(() => screen.getByText("Pause Bookings"));
    fireEvent.press(screen.getByText("Pause Bookings"));
    await waitFor(() => expect(screen.getByTestId("action-modal")).toBeTruthy());
    fireEvent.press(screen.getByTestId("action-modal-close"));
    await waitFor(() => expect(screen.queryByTestId("action-modal")).toBeNull());
  });

  it("calls RestaurantActionModal onSuccess callback (lines 241-242)", async () => {
    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());
    await waitFor(() => screen.getByText("Pause Bookings"));
    fireEvent.press(screen.getByText("Pause Bookings"));
    await waitFor(() => expect(screen.getByTestId("action-modal")).toBeTruthy());
    fireEvent.press(screen.getByTestId("action-modal-success"));
    await waitFor(() => expect(screen.getByTestId("alert-modal")).toBeTruthy());
    expect(screen.getByText("Action succeeded")).toBeTruthy();
  });

  it("calls AlertModal onClose callback (line 250)", async () => {
    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());
    fireEvent.press(screen.getByText("Pause Bookings"));
    await waitFor(() => expect(screen.getByTestId("action-modal")).toBeTruthy());
    fireEvent.press(screen.getByTestId("action-modal-success"));
    await waitFor(() => expect(screen.getByTestId("alert-modal")).toBeTruthy());
    fireEvent.press(screen.getByTestId("alert-modal-close"));
    await waitFor(() => expect(screen.queryByTestId("alert-modal")).toBeNull());
  });

  it("calls BookingDetailPopup onClose callback (line 255)", async () => {
    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());
    await waitFor(() => screen.getByText("today@test.com"));
    fireEvent.press(screen.getByText("today@test.com"));
    await waitFor(() => expect(screen.getByTestId("booking-detail-popup")).toBeTruthy());
    fireEvent.press(screen.getByTestId("booking-popup-close"));
    await waitFor(() => expect(screen.queryByTestId("booking-detail-popup")).toBeNull());
  });

  it("re-fetches dashboard stats when a booking is mutated in the detail popup", async () => {
    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());
    await waitFor(() => screen.getByText("today@test.com"));
    expect(getAdminDashboardStats).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByText("today@test.com"));
    await waitFor(() => expect(screen.getByTestId("booking-detail-popup")).toBeTruthy());
    fireEvent.press(screen.getByTestId("booking-popup-mutate"));

    await waitFor(() => expect(getAdminDashboardStats).toHaveBeenCalledTimes(2));
  });

  it("re-fetches dashboard stats when the restaurant action modal closes", async () => {
    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());
    await waitFor(() => screen.getByText("Pause Bookings"));
    expect(getAdminDashboardStats).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByText("Pause Bookings"));
    await waitFor(() => expect(screen.getByTestId("action-modal")).toBeTruthy());
    fireEvent.press(screen.getByTestId("action-modal-close"));

    await waitFor(() => expect(getAdminDashboardStats).toHaveBeenCalledTimes(2));
  });

  it("defaults to the T-x relative occupancy labels", async () => {
    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());

    expect(screen.getByText("T-6")).toBeTruthy();
    expect(screen.getByText("Today")).toBeTruthy();
  });

  it("swaps to calendar date labels when the Dates toggle is pressed", async () => {
    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());

    // Sanity: relative label present before toggling
    expect(screen.getByText("T-6")).toBeTruthy();

    fireEvent.press(screen.getByTestId("occupancy-toggle-calendar"));

    // T-6 should be replaced by the oldest calendar date; Today remains.
    expect(screen.queryByText("T-6")).toBeNull();
    expect(screen.getByText("Today")).toBeTruthy();
    // The oldest bar's date (6 days ago) should render as a short month/day.
    const oldest = new Date();
    oldest.setDate(oldest.getDate() - 6);
    const oldestLabel = oldest.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    expect(screen.getByText(oldestLabel)).toBeTruthy();
  });

  it("restores T-x labels when switching back to relative mode", async () => {
    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());

    fireEvent.press(screen.getByTestId("occupancy-toggle-calendar"));
    expect(screen.queryByText("T-6")).toBeNull();

    fireEvent.press(screen.getByTestId("occupancy-toggle-relative"));
    expect(screen.getByText("T-6")).toBeTruthy();
  });

  it("renders a summary line with total, average, and peak", async () => {
    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());

    // occupancyCounts = [1,2,3,4,5,6,12] → total 33, avg 33/7 = 4.7/day, peak = Today
    const summary = screen.getByTestId("occupancy-summary");
    expect(summary.props.children).toEqual(expect.stringContaining("33 bookings · 4.7/day · peak"));
  });

  it("shows the raw booking count above each bar", async () => {
    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());

    // Peak bar (index 6, count 12)
    expect(screen.getByTestId("occupancy-count-6").props.children).toBe(12);
    // First bar (index 0, count 1)
    expect(screen.getByTestId("occupancy-count-0").props.children).toBe(1);
  });

  it("renders the no-bookings summary and does not crash when counts are all zero", async () => {
    (getAdminDashboardStats as jest.Mock).mockResolvedValue({
      ...mockStats,
      occupancyData: [0, 0, 0, 0, 0, 0, 0],
      occupancyCounts: [0, 0, 0, 0, 0, 0, 0],
    });

    const { queryByTestId } = renderWithProviders(<AdminDashboardScreen />);
    await waitFor(() => expect(queryByTestId("dashboard-spinner")).toBeNull());

    expect(screen.getByTestId("occupancy-summary").props.children).toBe(
      "No bookings in the last 7 days"
    );
    // Counts still render as 0 above each bar
    expect(screen.getByTestId("occupancy-count-6").props.children).toBe(0);
  });
});
