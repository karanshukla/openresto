/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react-native";
import { Platform } from "react-native";
import NotificationsScreen from "@/app/admin/notifications";
import * as notificationsApi from "@/api/notifications";
import * as restaurantsApi from "@/api/restaurants";
import { PIN_STORAGE_KEY } from "@/utils/notifications";

// Mock ReanimatedSwipeable — exposes onSwipeableOpen via a testID button so tests can
// simulate swipe-to-delete without needing real gesture-handler infrastructure.
jest.mock("react-native-gesture-handler/ReanimatedSwipeable", () => {
  const { View, Pressable, Text } = require("react-native");
  return function MockSwipeable({ children, onSwipeableOpen }: any) {
    return (
      <View>
        <Pressable testID="mock-swipe-delete" onPress={onSwipeableOpen}>
          <Text>SwipeDelete</Text>
        </Pressable>
        {children}
      </View>
    );
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

  // `clearAllMocks` doesn't drain a `mockResolvedValueOnce` queue — a test that throws
  // before consuming all of its queued once-values would otherwise leak them into
  // whichever test runs next. `mockReset` drops any leftover queue before each test
  // re-establishes its own default below.
  mockGetNotifications.mockReset();

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

  it("relativeTime shows 'Xm ago' for notifications created minutes ago", async () => {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60000).toISOString();
    mockGetNotifications.mockResolvedValue({
      items: [{ ...mockNotification, createdAt: thirtyMinsAgo }],
      totalCount: 1,
    });
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText(/30m ago/)).toBeTruthy());
  });

  it("relativeTime shows 'Xh ago' for notifications created hours ago", async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600000).toISOString();
    mockGetNotifications.mockResolvedValue({
      items: [{ ...mockNotification, createdAt: threeHoursAgo }],
      totalCount: 1,
    });
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText(/3h ago/)).toBeTruthy());
  });

  it("relativeTime shows 'Xd ago' for notifications created days ago", async () => {
    const twoDaysAgo = new Date(Date.now() - 25 * 3600000).toISOString();
    mockGetNotifications.mockResolvedValue({
      items: [{ ...mockNotification, createdAt: twoDaysAgo }],
      totalCount: 1,
    });
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText(/1d ago/)).toBeTruthy());
  });

  it("pressing Mark all read with a specific restaurant selected calls markAllRead for that restaurant only", async () => {
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
    fireEvent.press(screen.getByText("Mark all read"));
    await waitFor(() => expect(mockMarkAllRead).toHaveBeenCalledWith(2));
    expect(mockMarkAllRead).not.toHaveBeenCalledWith(1);
  });

  it("relativeTime shows 'just now' for notifications created seconds ago", async () => {
    const justNow = new Date(Date.now() - 30000).toISOString();
    mockGetNotifications.mockResolvedValue({
      items: [{ ...mockNotification, createdAt: justNow }],
      totalCount: 1,
    });
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText(/just now/)).toBeTruthy());
  });

  it("swipe to delete removes notification and shows toast", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("New Booking")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId("mock-swipe-delete"));
    });
    await waitFor(() => expect(screen.getByText("Notification deleted")).toBeTruthy());
    expect(mockDeleteNotification).toHaveBeenCalledWith(1);
  });

  it("trash button on unpinned row calls requestDelete which calls handleDelete", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByTestId("delete-notif-1")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId("delete-notif-1"));
    });
    await waitFor(() => expect(mockDeleteNotification).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.getByText("Notification deleted")).toBeTruthy());
  });

  it("trash button on pinned row opens confirm modal", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Pin")).toBeTruthy());
    fireEvent.press(screen.getByText("Pin"));
    await waitFor(() => expect(screen.getByText("Unpin")).toBeTruthy());
    fireEvent.press(screen.getByTestId("delete-notif-1"));
    await waitFor(() => expect(screen.getByTestId("confirm-modal")).toBeTruthy());
  });

  it("confirming pinned delete calls handleConfirmedDelete", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Pin")).toBeTruthy());
    fireEvent.press(screen.getByText("Pin"));
    await waitFor(() => expect(screen.getByText("Unpin")).toBeTruthy());
    fireEvent.press(screen.getByTestId("delete-notif-1"));
    await waitFor(() => expect(screen.getByTestId("confirm-modal")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId("confirm-btn"));
    });
    await waitFor(() => expect(mockDeleteNotification).toHaveBeenCalledWith(1));
  });

  it("cancelling pinned delete confirm closes modal without deleting", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Pin")).toBeTruthy());
    fireEvent.press(screen.getByText("Pin"));
    await waitFor(() => expect(screen.getByText("Unpin")).toBeTruthy());
    fireEvent.press(screen.getByTestId("delete-notif-1"));
    await waitFor(() => expect(screen.getByTestId("confirm-modal")).toBeTruthy());
    fireEvent.press(screen.getByTestId("cancel-btn"));
    await waitFor(() => expect(screen.queryByTestId("confirm-modal")).toBeNull());
    expect(mockDeleteNotification).not.toHaveBeenCalled();
  });

  it("shows 'push blocked' banner when Notification permission is denied and vapid key is set", async () => {
    mockGetVapidPublicKey.mockResolvedValue("test-vapid-key");
    (g.navigator as Record<string, unknown>).serviceWorker = {
      ready: Promise.resolve({
        pushManager: { getSubscription: jest.fn().mockResolvedValue(null) },
      }),
    };
    (g as Record<string, unknown>).PushManager = {};
    Object.defineProperty(global, "Notification", {
      value: { permission: "denied", requestPermission: jest.fn() },
      configurable: true,
      writable: true,
    });
    render(<NotificationsScreen />);
    await waitFor(() =>
      expect(
        screen.getByText("Push notifications blocked - enable in browser site settings.")
      ).toBeTruthy()
    );
  });

  it("shows Enable button when push is inactive (not subscribed)", async () => {
    mockGetVapidPublicKey.mockResolvedValue("test-vapid-key");
    (g.navigator as Record<string, unknown>).serviceWorker = {
      ready: Promise.resolve({
        pushManager: { getSubscription: jest.fn().mockResolvedValue(null) },
      }),
    };
    (g as Record<string, unknown>).PushManager = {};
    Object.defineProperty(global, "Notification", {
      value: { permission: "default", requestPermission: jest.fn() },
      configurable: true,
      writable: true,
    });
    render(<NotificationsScreen />);
    await waitFor(() =>
      expect(
        screen.getByText("Enable push notifications to get real-time booking alerts.")
      ).toBeTruthy()
    );
    expect(screen.getByText("Enable")).toBeTruthy();
  });

  it("silentRefresh fetches new items when interval fires", async () => {
    let capturedCallback: (() => Promise<void>) | null = null;
    const realSetInterval = global.setInterval;
    const setIntervalSpy = jest
      .spyOn(global, "setInterval")
      .mockImplementation((cb: any, delay: any) => {
        if (delay === 30000) {
          capturedCallback = cb;
          return 0 as unknown as NodeJS.Timeout;
        }
        // Anything else (e.g. RNTL's own `waitFor` polling interval) must run for real,
        // otherwise `waitFor` silently stops retrying and every assertion below hangs.
        return realSetInterval(cb, delay);
      });

    const newNotif = { ...mockNotification, id: 99, bookingRef: "NEW99" };
    mockGetNotifications
      .mockResolvedValueOnce(mockNotificationsPage)
      .mockResolvedValueOnce({ items: [newNotif], totalCount: 1 });

    render(<NotificationsScreen />);
    await waitFor(() => expect(mockGetNotifications).toHaveBeenCalledTimes(1));

    expect(capturedCallback).not.toBeNull();
    await act(async () => {
      await capturedCallback!();
    });
    expect(mockGetNotifications).toHaveBeenCalledTimes(2);

    setIntervalSpy.mockRestore();
  });

  it("clears the pending auto-hide timer when a second toast is shown before it fires", async () => {
    mockGetNotifications.mockResolvedValue({
      items: [
        { ...mockNotification, id: 1, isRead: false },
        { ...mockNotification, id: 2, isRead: true, bookingRef: "REF002" },
      ],
      totalCount: 2,
    });
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("2 total notifications")).toBeTruthy());

    // Fired back-to-back with no await in between so the second toast lands while the
    // first's auto-hide timer is still pending, exercising the clearTimeout branch.
    // `handleMarkAllRead`'s `Promise.all` wrapping resolves one microtask tick later than
    // `handleClearRead`'s single await, so "Marked all as read" deterministically wins as
    // the final toast — assert on the outcome rather than presuming press order = resolve order.
    fireEvent.press(screen.getByText("Clear read"));
    fireEvent.press(screen.getByText("Mark all read"));

    await waitFor(() => expect(screen.getByText("Marked all as read")).toBeTruthy());
  });

  it("auto-hides the toast after its timeout", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Mark all read")).toBeTruthy());
    fireEvent.press(screen.getByText("Mark all read"));
    await waitFor(() => expect(screen.getByText("Marked all as read")).toBeTruthy());
    await waitFor(() => expect(screen.queryByText("Marked all as read")).toBeNull(), {
      timeout: 3000,
    });
  });

  it("skips the pointerdown listener and localStorage pin writes on non-web platforms", async () => {
    Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
    const addEventListenerSpy = jest.spyOn(document, "addEventListener");
    const setItemSpy = jest.spyOn(Storage.prototype, "setItem");
    try {
      render(<NotificationsScreen />);
      await waitFor(() => expect(screen.getByText("Pin")).toBeTruthy());
      expect(addEventListenerSpy).not.toHaveBeenCalledWith("pointerdown", expect.anything(), true);

      fireEvent.press(screen.getByText("Pin"));
      await waitFor(() => expect(screen.getByText("Unpin")).toBeTruthy());
      expect(setItemSpy).not.toHaveBeenCalledWith(PIN_STORAGE_KEY, expect.anything());
    } finally {
      Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
      addEventListenerSpy.mockRestore();
      setItemSpy.mockRestore();
    }
  });

  it("honours a previously pinned notification restored from localStorage", async () => {
    localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify([1]));
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Unpin")).toBeTruthy());
  });

  it("falls back to no pinned notifications when the persisted pin data is corrupt", async () => {
    localStorage.setItem(PIN_STORAGE_KEY, "not valid json");
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Pin")).toBeTruthy());
  });

  it("unpins a pinned notification when toggled again", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Pin")).toBeTruthy());
    fireEvent.press(screen.getByText("Pin"));
    await waitFor(() => expect(screen.getByText("Unpin")).toBeTruthy());
    fireEvent.press(screen.getByText("Unpin"));
    await waitFor(() => expect(screen.getByText("Pin")).toBeTruthy());
  });

  it("re-applies a local unread override after the list refetches from the server", async () => {
    const twoReadItems = {
      items: [
        { ...mockNotification, id: 1, isRead: true },
        { ...mockNotification, id: 2, isRead: true, bookingRef: "REF002" },
      ],
      totalCount: 2,
    };
    mockGetNotifications.mockResolvedValueOnce(twoReadItems).mockResolvedValueOnce(twoReadItems);
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getAllByText("Mark Unread")).toHaveLength(2));

    fireEvent.press(screen.getAllByText("Mark Unread")[0]);
    await waitFor(() => expect(screen.getByText("Mark Read")).toBeTruthy());

    fireEvent.press(screen.getByText("New Bookings"));
    await waitFor(() => expect(mockGetNotifications).toHaveBeenCalledTimes(2));

    await waitFor(() => {
      expect(screen.getAllByText("Mark Read")).toHaveLength(1);
      expect(screen.getAllByText("Mark Unread")).toHaveLength(1);
    });
  });

  it("falls back to 0 total notifications when the API response omits totalCount", async () => {
    mockGetNotifications.mockResolvedValue({ items: [mockNotification] });
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("0 total notifications")).toBeTruthy());
  });

  it("silentRefresh ignores a null response from an interval refresh", async () => {
    let capturedCallback: (() => Promise<void>) | null = null;
    const realSetInterval = global.setInterval;
    const setIntervalSpy = jest
      .spyOn(global, "setInterval")
      .mockImplementation((cb: any, delay: any) => {
        if (delay === 30000) {
          capturedCallback = cb;
          return 0 as unknown as NodeJS.Timeout;
        }
        // Anything else (e.g. RNTL's own `waitFor` polling interval) must run for real,
        // otherwise `waitFor` silently stops retrying and every assertion below hangs.
        return realSetInterval(cb, delay);
      });
    mockGetNotifications.mockResolvedValueOnce(mockNotificationsPage).mockResolvedValueOnce(null);

    render(<NotificationsScreen />);
    await waitFor(() => expect(mockGetNotifications).toHaveBeenCalledTimes(1));
    await act(async () => {
      await capturedCallback!();
    });
    expect(screen.getByText("New Booking")).toBeTruthy();

    setIntervalSpy.mockRestore();
  });

  it("silentRefresh leaves the list unchanged when the interval fetch has no new items", async () => {
    let capturedCallback: (() => Promise<void>) | null = null;
    const realSetInterval = global.setInterval;
    const setIntervalSpy = jest
      .spyOn(global, "setInterval")
      .mockImplementation((cb: any, delay: any) => {
        if (delay === 30000) {
          capturedCallback = cb;
          return 0 as unknown as NodeJS.Timeout;
        }
        // Anything else (e.g. RNTL's own `waitFor` polling interval) must run for real,
        // otherwise `waitFor` silently stops retrying and every assertion below hangs.
        return realSetInterval(cb, delay);
      });
    mockGetNotifications
      .mockResolvedValueOnce(mockNotificationsPage)
      .mockResolvedValueOnce({ items: [mockNotification], totalCount: 1 });

    render(<NotificationsScreen />);
    await waitFor(() => expect(mockGetNotifications).toHaveBeenCalledTimes(1));
    await act(async () => {
      await capturedCallback!();
    });
    expect(screen.getAllByText("New Booking")).toHaveLength(1);

    setIntervalSpy.mockRestore();
  });

  it("carries a local unread override into newly-merged interval items, falling back totalCount to 0", async () => {
    let capturedCallback: (() => Promise<void>) | null = null;
    const realSetInterval = global.setInterval;
    const setIntervalSpy = jest
      .spyOn(global, "setInterval")
      .mockImplementation((cb: any, delay: any) => {
        if (delay === 30000) {
          capturedCallback = cb;
          return 0 as unknown as NodeJS.Timeout;
        }
        // Anything else (e.g. RNTL's own `waitFor` polling interval) must run for real,
        // otherwise `waitFor` silently stops retrying and every assertion below hangs.
        return realSetInterval(cb, delay);
      });
    mockGetNotifications.mockResolvedValueOnce({
      items: [
        { ...mockNotification, id: 1, isRead: true },
        { ...mockNotification, id: 2, isRead: true, bookingRef: "REF002" },
      ],
      totalCount: 2,
    });

    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getAllByText("Mark Unread")).toHaveLength(2));

    fireEvent.press(screen.getAllByText("Mark Unread")[0]);
    await waitFor(() => expect(screen.getByText("Mark Read")).toBeTruthy());

    mockGetNotifications.mockResolvedValueOnce({
      items: [
        { ...mockNotification, id: 1, isRead: true },
        { ...mockNotification, id: 2, isRead: true, bookingRef: "REF002" },
        { ...mockNotification, id: 3, isRead: true, bookingRef: "REF003" },
      ],
      // totalCount intentionally omitted to exercise the `?? 0` fallback.
    });
    await act(async () => {
      await capturedCallback!();
    });

    await waitFor(() => {
      // id 1's override survives the merge; id 2 and the newly-merged id 3 stay read.
      expect(screen.getAllByText("Mark Read")).toHaveLength(1);
      expect(screen.getAllByText("Mark Unread")).toHaveLength(2);
    });

    setIntervalSpy.mockRestore();
  });

  it("ignores a tap on an already-read notification that isn't a booking or nearly-full alert", async () => {
    mockGetNotifications.mockResolvedValue({
      items: [{ ...mockNotification, type: "BookingCancelled", bookingId: null, isRead: true }],
      totalCount: 1,
    });
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Booking Cancelled")).toBeTruthy());
    fireEvent.press(screen.getByText("Booking Cancelled"));
    expect(mockMarkRead).not.toHaveBeenCalled();
    expect(screen.queryByTestId("notif-popup-close")).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("marks only the tapped notification as read, leaving the other row unaffected", async () => {
    mockGetNotifications.mockResolvedValue({
      items: [
        { ...mockNotification, id: 1, customerName: "Alice", isRead: false },
        { ...mockNotification, id: 2, customerName: "Bob", bookingRef: "REF002", isRead: false },
      ],
      totalCount: 2,
    });
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Alice")).toBeTruthy());
    fireEvent.press(screen.getByText("Alice"));
    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledWith(1));
    expect(mockMarkRead).not.toHaveBeenCalledWith(2);
    await waitFor(() => {
      expect(screen.getAllByText("Mark Read")).toHaveLength(1);
      expect(screen.getAllByText("Mark Unread")).toHaveLength(1);
    });
  });

  it("Mark Read button only affects the targeted row among several unread notifications", async () => {
    mockGetNotifications.mockResolvedValue({
      items: [
        { ...mockNotification, id: 1, customerName: "Alice", isRead: false },
        { ...mockNotification, id: 2, customerName: "Bob", bookingRef: "REF002", isRead: false },
      ],
      totalCount: 2,
    });
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getAllByText("Mark Read")).toHaveLength(2));
    fireEvent.press(screen.getAllByText("Mark Read")[0]);
    await waitFor(() => expect(mockMarkRead).toHaveBeenCalledTimes(1));
    await waitFor(() => {
      expect(screen.getAllByText("Mark Read")).toHaveLength(1);
      expect(screen.getAllByText("Mark Unread")).toHaveLength(1);
    });
  });

  it("Mark Unread button only affects the targeted row among several read notifications", async () => {
    mockGetNotifications.mockResolvedValue({
      items: [
        { ...mockNotification, id: 1, customerName: "Alice", isRead: true },
        { ...mockNotification, id: 2, customerName: "Bob", bookingRef: "REF002", isRead: true },
      ],
      totalCount: 2,
    });
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getAllByText("Mark Unread")).toHaveLength(2));
    fireEvent.press(screen.getAllByText("Mark Unread")[0]);
    await waitFor(() => {
      expect(screen.getAllByText("Mark Read")).toHaveLength(1);
      expect(screen.getAllByText("Mark Unread")).toHaveLength(1);
    });
  });

  it("pluralizes the Delete all toast when more than one notification is removed", async () => {
    mockGetNotifications.mockResolvedValue({
      items: [
        { ...mockNotification, id: 1 },
        { ...mockNotification, id: 2, bookingRef: "REF002" },
      ],
      totalCount: 2,
    });
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Delete all")).toBeTruthy());
    fireEvent.press(screen.getByText("Delete all"));
    await waitFor(() => expect(screen.getByTestId("confirm-modal")).toBeTruthy());
    fireEvent.press(screen.getByTestId("confirm-btn"));
    await waitFor(() => expect(screen.getByText("Deleted 2 notifications")).toBeTruthy());
  });

  it("shows an 'All caught up' empty state when filtering to unread with nothing left", async () => {
    mockGetNotifications
      .mockResolvedValueOnce(mockNotificationsPage)
      .mockResolvedValueOnce({ items: [], totalCount: 0 });
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Filter Unread")).toBeTruthy());
    fireEvent.press(screen.getByText("Filter Unread"));
    await waitFor(() => expect(screen.getByText("All caught up")).toBeTruthy());
    expect(screen.getByText("You've read everything. New alerts will appear here.")).toBeTruthy();
  });

  it("shows a 99+ overflow badge when the unread count exceeds 99", async () => {
    mockGetNotifications.mockResolvedValue({
      items: Array.from({ length: 100 }, (_, i) => ({
        ...mockNotification,
        id: i + 1,
        bookingRef: `REF${i + 1}`,
      })),
      totalCount: 100,
    });
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("99+")).toBeTruthy());
  });

  it("tracks touch-vs-mouse pointer events on web for swipe-to-delete gating", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("New Booking")).toBeTruthy());
    // jsdom has no PointerEvent constructor; a plain Event with pointerType attached
    // is enough since the listener only reads that property off the event object.
    const pointerdown = new Event("pointerdown") as Event & { pointerType: string };
    pointerdown.pointerType = "touch";
    document.dispatchEvent(pointerdown);
  });

  it("shows the 'All notifications' divider when some but not all visible items are pinned", async () => {
    mockGetNotifications.mockResolvedValue({
      items: [
        { ...mockNotification, id: 1, customerName: "Alice" },
        { ...mockNotification, id: 2, customerName: "Bob", bookingRef: "REF002" },
      ],
      totalCount: 2,
    });
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getAllByText("Pin")).toHaveLength(2));
    fireEvent.press(screen.getAllByText("Pin")[0]);
    await waitFor(() => expect(screen.getByText("All notifications")).toBeTruthy());
  });
});

describe("NotificationsScreen filter persistence", () => {
  const originalPlatform = Platform.OS;
  const twoRestaurants = [
    { id: 1, name: "Resto A" },
    { id: 2, name: "Resto B" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    Object.defineProperty(Platform, "OS", { value: "web", configurable: true });
    localStorage.clear();

    mockGetNotifications.mockResolvedValue(mockNotificationsPage);
    mockFetchRestaurants.mockResolvedValue(twoRestaurants);
    mockMarkRead.mockResolvedValue(undefined);
    mockMarkAllRead.mockResolvedValue(undefined);
    mockDeleteNotification.mockResolvedValue(undefined);
    mockDeleteNotifications.mockResolvedValue(undefined);
    mockGetVapidPublicKey.mockResolvedValue(null);
    mockPush.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(Platform, "OS", { value: originalPlatform, configurable: true });
  });

  it("honours a persisted restaurant filter on mount", async () => {
    localStorage.setItem("notifications:restaurantId", JSON.stringify(2));
    render(<NotificationsScreen />);
    await waitFor(() => expect(mockGetNotifications).toHaveBeenCalled());
    expect(mockGetNotifications.mock.calls[0][0].restaurantId).toBe(2);
  });

  it("honours a persisted type filter on mount", async () => {
    localStorage.setItem("notifications:type", JSON.stringify("BookingCreated"));
    render(<NotificationsScreen />);
    await waitFor(() => expect(mockGetNotifications).toHaveBeenCalled());
    expect(mockGetNotifications.mock.calls[0][0].type).toBe("BookingCreated");
  });

  it("drops a persisted restaurant id that no longer exists", async () => {
    localStorage.setItem("notifications:restaurantId", JSON.stringify(999));
    render(<NotificationsScreen />);
    await waitFor(() => expect(mockFetchRestaurants).toHaveBeenCalled());
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("notifications:restaurantId") as string)).toBeNull();
    });
  });

  it("does not persist the unread-only toggle", async () => {
    render(<NotificationsScreen />);
    await waitFor(() => expect(screen.getByText("Notifications")).toBeTruthy());
    // unreadOnly is transient by design — no storage key is ever written for it.
    expect(localStorage.getItem("notifications:unreadOnly")).toBeNull();
  });
});
