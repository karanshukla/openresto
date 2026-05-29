import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ExtendBookingActions } from "@/components/admin/bookings/ExtendBookingActions";

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#007AFF", appName: "Test" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

describe("ExtendBookingActions", () => {
  const defaultProps = {
    borderColor: "#eee",
    mutedColor: "#888",
    extending: false,
    onExtend: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders extend buttons for 30, 60, and 90 minutes", () => {
    render(<ExtendBookingActions {...defaultProps} />);

    expect(screen.getByText("+30 min")).toBeTruthy();
    expect(screen.getByText("+60 min")).toBeTruthy();
    expect(screen.getByText("+90 min")).toBeTruthy();
  });

  it("calls onExtend with correct minutes when a button is pressed", () => {
    const onExtend = jest.fn();
    render(<ExtendBookingActions {...defaultProps} onExtend={onExtend} />);

    fireEvent.press(screen.getByText("+30 min"));
    expect(onExtend).toHaveBeenCalledWith(30);

    fireEvent.press(screen.getByText("+60 min"));
    expect(onExtend).toHaveBeenCalledWith(60);

    fireEvent.press(screen.getByText("+90 min"));
    expect(onExtend).toHaveBeenCalledWith(90);
  });

  it("disables buttons when extending is true", () => {
    const onExtend = jest.fn();
    render(<ExtendBookingActions {...defaultProps} extending={true} onExtend={onExtend} />);

    fireEvent.press(screen.getByText("+30 min"));
    expect(onExtend).not.toHaveBeenCalled();
  });

  it("renders the section header with extend booking label", () => {
    render(<ExtendBookingActions {...defaultProps} />);
    expect(screen.getByText("Extend booking")).toBeTruthy();
  });
});
