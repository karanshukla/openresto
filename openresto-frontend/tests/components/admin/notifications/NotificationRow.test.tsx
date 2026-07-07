import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { NotificationRow } from "@/components/admin/notifications/NotificationRow";
import { AdminNotificationDto } from "@/api/notifications";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("react-native-gesture-handler/ReanimatedSwipeable", () => {
  const { View } = require("react-native");
  return ({ children }: { children: React.ReactNode }) => <>{children}</>;
});

const theme = {
  borderColor: "#ddd",
  mutedColor: "#888",
  isDark: false,
  primaryColor: "#0a7ea4",
};

const baseNotif: AdminNotificationDto = {
  id: 1,
  type: "BookingCreated",
  isRead: false,
  customerName: "Alice",
  bookingRef: "REF001",
  restaurantName: "Downtown",
  seats: 4,
  bookingDate: "2026-07-15T19:00:00Z",
  createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
} as AdminNotificationDto;

const noop = () => {};

describe("NotificationRow", () => {
  it("renders the type label, customer name, ref, and meta", () => {
    render(
      <NotificationRow
        notification={baseNotif}
        isPinned={false}
        isLast={false}
        webTouchActive={false}
        onRowTap={noop}
        onTogglePin={noop}
        onMarkRead={noop}
        onMarkUnread={noop}
        onRequestDelete={noop}
        onSwipeDelete={noop}
        {...theme}
      />
    );
    expect(screen.getByText("New Booking")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByText("#REF001")).toBeTruthy();
    expect(screen.getByText(/Downtown/)).toBeTruthy();
    expect(screen.getByText(/4 guests/)).toBeTruthy();
  });

  it("shows 'Mark Read' for an unread row", () => {
    render(
      <NotificationRow
        notification={baseNotif}
        isPinned={false}
        isLast={false}
        webTouchActive={false}
        onRowTap={noop}
        onTogglePin={noop}
        onMarkRead={noop}
        onMarkUnread={noop}
        onRequestDelete={noop}
        onSwipeDelete={noop}
        {...theme}
      />
    );
    expect(screen.getByText("Mark Read")).toBeTruthy();
  });

  it("shows 'Mark Unread' for a read row", () => {
    render(
      <NotificationRow
        notification={{ ...baseNotif, isRead: true }}
        isPinned={false}
        isLast={false}
        webTouchActive={false}
        onRowTap={noop}
        onTogglePin={noop}
        onMarkRead={noop}
        onMarkUnread={noop}
        onRequestDelete={noop}
        onSwipeDelete={noop}
        {...theme}
      />
    );
    expect(screen.getByText("Mark Unread")).toBeTruthy();
  });

  it("fires onTogglePin when Pin is pressed", () => {
    const onTogglePin = jest.fn();
    render(
      <NotificationRow
        notification={baseNotif}
        isPinned={false}
        isLast={false}
        webTouchActive={false}
        onRowTap={noop}
        onTogglePin={onTogglePin}
        onMarkRead={noop}
        onMarkUnread={noop}
        onRequestDelete={noop}
        onSwipeDelete={noop}
        {...theme}
      />
    );
    fireEvent.press(screen.getByText("Pin"));
    expect(onTogglePin).toHaveBeenCalledWith(1);
  });

  it("shows 'Unpin' when pinned", () => {
    render(
      <NotificationRow
        notification={baseNotif}
        isPinned
        isLast={false}
        webTouchActive={false}
        onRowTap={noop}
        onTogglePin={noop}
        onMarkRead={noop}
        onMarkUnread={noop}
        onRequestDelete={noop}
        onSwipeDelete={noop}
        {...theme}
      />
    );
    expect(screen.getByText("Unpin")).toBeTruthy();
  });
});
