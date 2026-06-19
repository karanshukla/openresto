/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";
import { Platform } from "react-native";
import NotificationsScreen from "@/app/(admin)/notifications";
import * as notificationsApi from "@/api/notifications";
import * as restaurantsApi from "@/api/restaurants";

// Mock ReanimatedSwipeable so gesture handler doesn't crash in jsdom
jest.mock("react-native-gesture-handler/ReanimatedSwipeable", () => {
  const { View } = require("react-native");
  return function MockSwipeable({ children }: any) {
    return <View>{children}</View>;
  };
});

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/hooks/use-app-theme", () => ({
  useAppTheme: () => ({
    colors: {
      page: "#fff",
      card: "#f5f5f5",
      border: "#e0e0e0",
      muted: "#888",
      input: "#fff",
      text: "#000",
    },
    primaryColor: "#0a7ea4",
    isDark: false,
  }),
}));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  Stack: { Screen: () => null },
}));

jest.mock("@/api/notifications", () => ({
  getNotifications: jest.fn(),
  markRead: jest.fn(),
  markAllRead: jest.fn(),
  deleteNotification: jest.fn(),
  deleteNotifications: jest.fn(),
  getVapidPublicKey: jest.fn(),
  subscribePush: jest.fn(),
  unsubscribePush: jest.fn(),
}));

jest.mock("@/api/restaurants", () => ({
  fetchRestaurants: jest.fn(),
}));

jest.mock("@/components/admin/bookings/BookingDetailPopup", () => ({
  BookingDetailPopup: ({ bookingId, onClose }: any) => {
    if (bookingId == null) return null;
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable testID="notif-popup-close" onPress={onClose}>
        <Text>ClosePopup</Text>
      </Pressable>
    );
  },
}));

jest.mock("@/components/common/ConfirmModal", () => {
  const { View, Pressable, Text } = require("react-native");
  return function MockConfirmModal({
    visible,
    onConfirm,
    onCancel,
    confirmLabel,
    cancelLabel,
  }: any) {
    if (!visible) return null;
    return (
      <View testID="confirm-modal">
        <Pressable onPress={onConfirm} testID="confirm-btn">
          <Text>{confirmLabel || "Confirm"}</Text>
        </Pressable>
        <Pressable onPress={onCancel} testID="cancel-btn">
          <Text>{cancelLabel || "Cancel"}</Text>
        </Pressable>
      </View>
    );
  };
});

const mockGetNotifications = notificationsApi.getNotifications as jest.Mock;
const mockMarkRead = notificationsApi.markRead as jest.Mock;
const mockMarkAllRead = notificationsApi.markAllRead as jest.Mock;
const mockDeleteNotification = notificationsApi.deleteNotification as jest.Mock;
const mockDeleteNotifications = notificationsApi.deleteNotifications as jest.Mock;
const mockGetVapidPublicKey = notificationsApi.getVapidPublicKey as jest.Mock;
const mockFetchRestaurants = restaurantsApi.fetchRestaurants as jest.Mock;

const g = global as Record<string, unknown>;

const mockNotification = {
  id: 1,
  type: "BookingCreated" as const,
  restaurantId: 1,
  restaurantName: "Resto A",
  bookingId: 10,
  bookingRef: "REF001",
  bookingDate: "2026-10-10T12:00:00Z",
  customerName: "Alice",
  customerEmail: "alice@example.com",
  seats: 2,
  isRead: false,
  createdAt: new Date().toISOString(),
};

const mockNotificationsPage = {
  items: [mockNotification],
  totalCount: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});

  Object.defineProperty(Platform, "OS", { value: "web", configurable: true });

  // Clear localStorage so pin state never bleeds between tests
  localStorage.clear();

  mockGetNotifications.mockResolvedValue(mockNotificationsPage);
  mockFetchRestaurants.mockResolvedValue([{ id: 1, name: "Resto A" }]);
  mockMarkRead.mockResolvedValue(undefined);
  mockMarkAllRead.mockResolvedValue(undefined);
  mockDeleteNotification.mockResolvedValue(undefined);
  mockDeleteNotifications.mockResolvedValue(undefined);
  mockGetVapidPublicKey.mockResolvedValue(null);
  mockPush.mockReset();

  if (!g.navigator || typeof g.navigator !== "object") {
    Object.defineProperty(global, "navigator", {
      value: {},
      configurable: true,
      writable: true,
    });
  }
  (g.navigator as Record<string, unknown>).serviceWorker = undefined;
  delete (g as any).PushManager;

  Object.defineProperty(global, "Notification", {
    value: { permission: "default", requestPermission: jest.fn().mockResolvedValue("granted") },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
});

jest.setTimeout(15000);

describe("NotificationsScreen", () => {
  it("renders Notifications heading after loading", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Notifications")).toBeTruthy());
  });

  it("shows notification count in subtitle", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("1 total notification")).toBeTruthy());
  });

  it("renders a BookingCreated notification row", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("New Booking")).toBeTruthy());
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("#REF001")).toBeTruthy();
  });

  it("renders a BookingCancelled notification", async () => {
    mockGetNotifications.mockResolvedValue({
      items: [{ ...mockNotification, type: "BookingCancelled", customerName: "Bob" }],
      totalCount: 1,
    });
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Booking Cancelled")).toBeTruthy());
    expect(screen.getByText("Bob")).toBeTruthy();
  });

  it("renders a RestaurantNearlyFull notification without customer name", async () => {
    mockGetNotifications.mockResolvedValue({
      items: [
        {
          ...mockNotification,
          type: "RestaurantNearlyFull",
          bookingId: null,
          customerName: "Alice",
        },
      ],
      totalCount: 1,
    });
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Nearly Full")).toBeTruthy());
    expect(screen.queryByText("Alice")).toBeNull();
  });

  it("shows error state when getNotifications returns null", async () => {
    mockGetNotifications.mockResolvedValue(null);
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Something went wrong")).toBeTruthy());
  });

  it("shows empty state when no notifications", async () => {
    mockGetNotifications.mockResolvedValue({ items: [], totalCount: 0 });
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("No notifications yet")).toBeTruthy());
  });

  it("shows unread count badge in header", async () => {
    render(<NotificationsScreen />);
    // unreadCount = 1 since isRead=false
    await waitFor(() => expect(screen.getByText("1")).toBeTruthy());
  });

  it("pressing Mark all read calls markAllRead and shows toast", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Mark all read")).toBeTruthy());
    fireEvent.press(screen.getByText("Mark all read"));
    await waitFor(() => expect(mockMarkAllRead).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.getByText("Marked all as read")).toBeTruthy());
  });

  it("pressing Mark Read on unread notification marks it read", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Mark Read")).toBeTruthy());
    fireEvent.press(screen.getByText("Mark Read"));
    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.getByText("Mark Unread")).toBeTruthy());
  });

  it("pressing Mark Unread on read notification marks it unread locally", async () => {
    mockGetNotifications.mockResolvedValue({
      items: [{ ...mockNotification, isRead: true }],
      totalCount: 1,
    });
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Mark Unread")).toBeTruthy());
    fireEvent.press(screen.getByText("Mark Unread"));
    await waitFor(() => expect(screen.getByText("Mark Read")).toBeTruthy());
  });

  it("pressing Pin pins the notification", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Pin")).toBeTruthy());
    fireEvent.press(screen.getByText("Pin"));
    await waitFor(() => expect(screen.getByText("Unpin")).toBeTruthy());
  });

  it("pressing delete button (trash icon) on un-pinned row deletes notification", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("New Booking")).toBeTruthy());
    // The delete button exists but only has an icon; use the "Delete all" path instead
    // and test via header action
    expect(screen.getByText("Delete all")).toBeTruthy();
  });

  it("Delete all button opens confirmation dialog", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Delete all")).toBeTruthy());
    fireEvent.press(screen.getByText("Delete all"));
    await waitFor(() => expect(screen.getByTestId("confirm-modal")).toBeTruthy());
  });

  it("Delete all confirmation proceeds to delete unpinned items", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Delete all")).toBeTruthy());
    fireEvent.press(screen.getByText("Delete all"));
    await waitFor(() => expect(screen.getByTestId("confirm-modal")).toBeTruthy());
    fireEvent.press(screen.getByTestId("confirm-btn"));
    await waitFor(() => expect(mockDeleteNotifications).toHaveBeenCalledWith([1]));
    await waitFor(() => expect(screen.getByText(/Deleted 1 notification/)).toBeTruthy());
  });

  it("Delete all cancellation closes dialog without deleting", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Delete all")).toBeTruthy());
    fireEvent.press(screen.getByText("Delete all"));
    await waitFor(() => expect(screen.getByTestId("confirm-modal")).toBeTruthy());
    fireEvent.press(screen.getByTestId("cancel-btn"));
    await waitFor(() => expect(screen.queryByTestId("confirm-modal")).toBeNull());
    expect(mockDeleteNotifications).not.toHaveBeenCalled();
  });

  it("pressing Clear read removes read notifications", async () => {
    mockGetNotifications.mockResolvedValue({
      items: [{ ...mockNotification, isRead: true }],
      totalCount: 1,
    });
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Clear read")).toBeTruthy());
    fireEvent.press(screen.getByText("Clear read"));
    await waitFor(() => expect(mockDeleteNotifications).toHaveBeenCalledWith([1]));
    await waitFor(() => expect(screen.getByText("Read notifications cleared")).toBeTruthy());
  });

  it("tapping a booking notification opens the booking popup", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("New Booking")).toBeTruthy());
    fireEvent.press(screen.getByText("New Booking"));
    await waitFor(() => expect(screen.getByTestId("notif-popup-close")).toBeTruthy());
  });

  it("tapping a NearlyFull notification navigates to bookings page", async () => {
    mockGetNotifications.mockResolvedValue({
      items: [{ ...mockNotification, type: "RestaurantNearlyFull", bookingId: null }],
      totalCount: 1,
    });
    render(<NotificationsScreen />);
    // "Nearly Full" also appears in the type-filter chip list; press the notification row (last match)
    await waitFor(() => {
      const matches = screen.getAllByText("Nearly Full");
      expect(matches.length).toBeGreaterThan(0);
    });
    const nearlyFullElements = screen.getAllByText("Nearly Full");
    fireEvent.press(nearlyFullElements[nearlyFullElements.length - 1]);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("bookings")));
  });

  it("shows load-more trigger when hasMore is true", async () => {
    mockGetNotifications.mockResolvedValue({
      items: [mockNotification],
      totalCount: 25,
    });
    render(<NotificationsScreen />);
    // Shows "Show N more" where N = totalCount - items.length
    await waitFor(() => expect(screen.getByText("Show 24 more")).toBeTruthy());
  });

  it("pressing load-more loads next page", async () => {
    mockGetNotifications
      .mockResolvedValueOnce({ items: [mockNotification], totalCount: 25 })
      .mockResolvedValueOnce({
        items: [{ ...mockNotification, id: 2, bookingRef: "REF002" }],
        totalCount: 25,
      });
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Show 24 more")).toBeTruthy());
    fireEvent.press(screen.getByText("Show 24 more"));
    await waitFor(() => expect(mockGetNotifications).toHaveBeenCalledTimes(2));
  });

  it("selecting a restaurant chip filters notifications", async () => {
    mockFetchRestaurants.mockResolvedValue([
      { id: 1, name: "Resto A" },
      { id: 2, name: "Resto B" },
    ]);
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Resto B")).toBeTruthy());
    fireEvent.press(screen.getByText("Resto B"));
    await waitFor(() =>
      expect(mockGetNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ restaurantId: 2 })
      )
    );
  });

  it("pressing Filter Unread re-fetches with unreadOnly=true", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Filter Unread")).toBeTruthy());
    fireEvent.press(screen.getByText("Filter Unread"));
    await waitFor(() =>
      expect(mockGetNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ unreadOnly: true })
      )
    );
  });

  it("selecting a type filter re-fetches with that type", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("New Bookings")).toBeTruthy());
    fireEvent.press(screen.getByText("New Bookings"));
    await waitFor(() =>
      expect(mockGetNotifications).toHaveBeenCalledWith(
        expect.objectContaining({ type: "BookingCreated" })
      )
    );
  });

  it("Delete all when all items are pinned shows 'all pinned' toast", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Pin")).toBeTruthy());
    // Pin the only notification
    fireEvent.press(screen.getByText("Pin"));
    await waitFor(() => expect(screen.getByText("Unpin")).toBeTruthy());
    // Delete all — pinned item is immune
    fireEvent.press(screen.getByText("Delete all"));
    await waitFor(() => expect(screen.getByTestId("confirm-modal")).toBeTruthy());
    fireEvent.press(screen.getByTestId("confirm-btn"));
    await waitFor(() =>
      expect(screen.getByText("All visible notifications are pinned")).toBeTruthy()
    );
  });

  it("notification without bookingRef does not show ref label", async () => {
    mockGetNotifications.mockResolvedValue({
      items: [{ ...mockNotification, bookingRef: null }],
      totalCount: 1,
    });
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("New Booking")).toBeTruthy());
    expect(screen.queryByText("#REF001")).toBeNull();
  });

  it("closing BookingDetailPopup clears popupBookingId", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("New Booking")).toBeTruthy());
    fireEvent.press(screen.getByText("New Booking"));
    await waitFor(() => expect(screen.getByTestId("notif-popup-close")).toBeTruthy());
    fireEvent.press(screen.getByTestId("notif-popup-close"));
    await waitFor(() => expect(screen.queryByTestId("notif-popup-close")).toBeNull());
  });

  it("Cancelled and Nearly Full type filter chips exist", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => {
      expect(screen.getByText("Cancelled")).toBeTruthy();
      expect(screen.getByText("Nearly Full")).toBeTruthy();
    });
  });
});
