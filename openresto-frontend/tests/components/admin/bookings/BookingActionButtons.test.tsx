import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { BookingActionButtons } from "@/components/admin/bookings/BookingActionButtons";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

const baseProps = {
  isCancelled: false,
  uncancelling: false,
  deleting: false,
  mutedColor: "#888",
  onUncancel: jest.fn(),
  onCancel: jest.fn(),
  onPurge: jest.fn(),
};

describe("BookingActionButtons", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows Cancel Booking when not cancelled", () => {
    render(<BookingActionButtons {...baseProps} />);
    expect(screen.getByText("Cancel Booking")).toBeTruthy();
  });

  it("does not show Restore Booking when not cancelled", () => {
    render(<BookingActionButtons {...baseProps} />);
    expect(screen.queryByText("Restore Booking")).toBeNull();
  });

  it("shows Restore Booking when cancelled", () => {
    render(<BookingActionButtons {...baseProps} isCancelled />);
    expect(screen.getByText("Restore Booking")).toBeTruthy();
  });

  it("does not show Cancel Booking when already cancelled", () => {
    render(<BookingActionButtons {...baseProps} isCancelled />);
    expect(screen.queryByText("Cancel Booking")).toBeNull();
  });

  it("always shows Permanently Delete (GDPR)", () => {
    render(<BookingActionButtons {...baseProps} />);
    expect(screen.getByText("Permanently Delete (GDPR)")).toBeTruthy();
  });

  it("shows Cancelling… when deleting is true", () => {
    render(<BookingActionButtons {...baseProps} deleting />);
    expect(screen.getByText("Cancelling…")).toBeTruthy();
  });

  it("shows Restoring… when uncancelling is true", () => {
    render(<BookingActionButtons {...baseProps} isCancelled uncancelling />);
    expect(screen.getByText("Restoring…")).toBeTruthy();
  });

  it("calls onCancel when Cancel Booking is pressed", () => {
    render(<BookingActionButtons {...baseProps} />);
    fireEvent.press(screen.getByText("Cancel Booking"));
    expect(baseProps.onCancel).toHaveBeenCalled();
  });

  it("calls onPurge when Permanently Delete is pressed", () => {
    render(<BookingActionButtons {...baseProps} />);
    fireEvent.press(screen.getByText("Permanently Delete (GDPR)"));
    expect(baseProps.onPurge).toHaveBeenCalled();
  });

  it("calls onUncancel when Restore Booking is pressed", () => {
    render(<BookingActionButtons {...baseProps} isCancelled />);
    fireEvent.press(screen.getByText("Restore Booking"));
    expect(baseProps.onUncancel).toHaveBeenCalled();
  });
});
