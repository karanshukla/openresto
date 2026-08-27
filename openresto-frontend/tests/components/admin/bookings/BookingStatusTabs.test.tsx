import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { BookingStatusTabs } from "@/components/admin/bookings/BookingStatusTabs";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

const props = {
  value: "active" as const,
  onChange: jest.fn(),
  borderColor: "#ddd",
  cardBg: "#fff",
  mutedColor: "#666",
  primaryColor: "#0a7ea4",
};

describe("BookingStatusTabs", () => {
  beforeEach(() => jest.clearAllMocks());

  it("offers each set of bookings the list can show", () => {
    render(<BookingStatusTabs {...props} />);

    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("Past")).toBeTruthy();
    expect(screen.getByText("Cancelled")).toBeTruthy();
  });

  it("reports the tab that was pressed", () => {
    render(<BookingStatusTabs {...props} />);

    fireEvent.press(screen.getByTestId("status-tab-cancelled"));

    expect(props.onChange).toHaveBeenCalledWith("cancelled");
  });

  it("marks the active set as checked and the others as not", () => {
    render(<BookingStatusTabs {...props} value="past" />);

    expect(screen.getByTestId("status-tab-past").props.accessibilityState.checked).toBe(true);
    expect(screen.getByTestId("status-tab-active").props.accessibilityState.checked).toBe(false);
  });
});
