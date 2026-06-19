import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { BookingActionButtons } from "@/components/admin/bookings/BookingActionButtons";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe("BookingActionButtons", () => {
  describe("non-cancelled booking", () => {
    it("shows Cancel Booking button", () => {
      render(<BookingActionButtons {...baseProps} />);
      expect(screen.getByText("Cancel Booking")).toBeTruthy();
    });

    it("shows Permanently Delete (GDPR) button", () => {
      render(<BookingActionButtons {...baseProps} />);
      expect(screen.getByText("Permanently Delete (GDPR)")).toBeTruthy();
    });

    it("does not show Restore Booking button", () => {
      render(<BookingActionButtons {...baseProps} />);
      expect(screen.queryByText("Restore Booking")).toBeNull();
    });

    it("calls onCancel when Cancel Booking is pressed", () => {
      render(<BookingActionButtons {...baseProps} />);
      fireEvent.press(screen.getByText("Cancel Booking"));
      expect(baseProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it("calls onPurge when Permanently Delete is pressed", () => {
      render(<BookingActionButtons {...baseProps} />);
      fireEvent.press(screen.getByText("Permanently Delete (GDPR)"));
      expect(baseProps.onPurge).toHaveBeenCalledTimes(1);
    });

    it("does not call onCancel when deleting (disabled)", () => {
      render(<BookingActionButtons {...baseProps} deleting />);
      fireEvent.press(screen.getByText("Cancelling…"));
      expect(baseProps.onCancel).not.toHaveBeenCalled();
    });

    it("shows Cancelling… text when deleting", () => {
      render(<BookingActionButtons {...baseProps} deleting />);
      expect(screen.getByText("Cancelling…")).toBeTruthy();
    });
  });

  describe("cancelled booking", () => {
    const cancelledProps = { ...baseProps, isCancelled: true };

    it("shows Restore Booking button", () => {
      render(<BookingActionButtons {...cancelledProps} />);
      expect(screen.getByText("Restore Booking")).toBeTruthy();
    });

    it("does not show Cancel Booking button", () => {
      render(<BookingActionButtons {...cancelledProps} />);
      expect(screen.queryByText("Cancel Booking")).toBeNull();
    });

    it("calls onUncancel when Restore Booking is pressed", () => {
      render(<BookingActionButtons {...cancelledProps} />);
      fireEvent.press(screen.getByText("Restore Booking"));
      expect(baseProps.onUncancel).toHaveBeenCalledTimes(1);
    });

    it("does not call onUncancel when uncancelling (disabled)", () => {
      render(<BookingActionButtons {...cancelledProps} uncancelling />);
      fireEvent.press(screen.getByText("Restoring…"));
      expect(baseProps.onUncancel).not.toHaveBeenCalled();
    });

    it("shows Restoring… text when uncancelling", () => {
      render(<BookingActionButtons {...cancelledProps} uncancelling />);
      expect(screen.getByText("Restoring…")).toBeTruthy();
    });
  });

  describe("purge button", () => {
    it("does not call onPurge when deleting (disabled)", () => {
      render(<BookingActionButtons {...baseProps} deleting />);
      fireEvent.press(screen.getByText("Permanently Delete (GDPR)"));
      expect(baseProps.onPurge).not.toHaveBeenCalled();
    });
  });
});
