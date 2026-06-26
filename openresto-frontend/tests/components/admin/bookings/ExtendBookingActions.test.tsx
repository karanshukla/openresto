import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ExtendBookingActions } from "@/components/admin/bookings/ExtendBookingActions";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

const mockUseBrand = jest.fn(() => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }));
jest.mock("@/context/BrandContext", () => ({
  useBrand: () => mockUseBrand(),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

const baseProps = {
  borderColor: "#ddd",
  mutedColor: "#888",
  extending: false,
  onExtend: jest.fn(),
};

describe("ExtendBookingActions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all three extend buttons", () => {
    render(<ExtendBookingActions {...baseProps} />);
    expect(screen.getByText("+30 min")).toBeTruthy();
    expect(screen.getByText("+60 min")).toBeTruthy();
    expect(screen.getByText("+90 min")).toBeTruthy();
  });

  it("renders section title", () => {
    render(<ExtendBookingActions {...baseProps} />);
    expect(screen.getByText("Extend booking")).toBeTruthy();
  });

  it("calls onExtend with 30 when +30 min is pressed", () => {
    render(<ExtendBookingActions {...baseProps} />);
    fireEvent.press(screen.getByText("+30 min"));
    expect(baseProps.onExtend).toHaveBeenCalledWith(30);
  });

  it("calls onExtend with 60 when +60 min is pressed", () => {
    render(<ExtendBookingActions {...baseProps} />);
    fireEvent.press(screen.getByText("+60 min"));
    expect(baseProps.onExtend).toHaveBeenCalledWith(60);
  });

  it("calls onExtend with 90 when +90 min is pressed", () => {
    render(<ExtendBookingActions {...baseProps} />);
    fireEvent.press(screen.getByText("+90 min"));
    expect(baseProps.onExtend).toHaveBeenCalledWith(90);
  });

  it("does not call onExtend when extending is true (buttons disabled)", () => {
    render(<ExtendBookingActions {...baseProps} extending />);
    fireEvent.press(screen.getByText("+30 min"));
    expect(baseProps.onExtend).not.toHaveBeenCalled();
  });

  it("falls back to COLORS.primary when brand primaryColor is empty", () => {
    mockUseBrand.mockReturnValueOnce({ primaryColor: "", appName: "Open Resto" });
    render(<ExtendBookingActions {...baseProps} />);
    expect(screen.getByText("+30 min")).toBeTruthy();
    mockUseBrand.mockReturnValue({ primaryColor: "#0a7ea4", appName: "Open Resto" });
  });
});
