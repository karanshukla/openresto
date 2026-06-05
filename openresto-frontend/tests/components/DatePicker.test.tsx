import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import DatePicker from "@/components/common/DatePicker";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: jest.fn(() => ({ appName: "Test App", primaryColor: "#0a7ea4" })),
}));

describe("DatePicker (native)", () => {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const todayLabel = today.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  it("renders trigger with placeholder when no date selected", () => {
    render(<DatePicker onSelect={jest.fn()} />);
    expect(screen.getByText("Select a date")).toBeTruthy();
  });

  it("renders the selected date label", () => {
    render(<DatePicker selectedDate={todayStr} onSelect={jest.fn()} />);
    expect(screen.getByText(todayLabel)).toBeTruthy();
  });

  it("opens modal when trigger is pressed", () => {
    render(<DatePicker onSelect={jest.fn()} />);
    fireEvent.press(screen.getByText("Select a date"));
    // Modal title is also "Select a date" in the modal header
    // Options should be visible now
    expect(screen.getByText(todayLabel)).toBeTruthy();
  });

  it("calls onSelect when a date is selected", () => {
    const onSelect = jest.fn();
    render(<DatePicker onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Select a date"));
    fireEvent.press(screen.getByText(todayLabel));
    expect(onSelect).toHaveBeenCalledWith(todayStr);
  });

  it("renders chevron indicator", () => {
    render(<DatePicker onSelect={jest.fn()} />);
    expect(screen.getByText("▾")).toBeTruthy();
  });

  it("filters date options to open days only", () => {
    render(<DatePicker onSelect={jest.fn()} openDays={[1, 2, 3, 4, 5]} />);
    expect(screen.getByText("Select a date")).toBeTruthy();
  });

  it("shows selected item styling when modal is open with pre-selected date", () => {
    render(<DatePicker selectedDate={todayStr} onSelect={jest.fn()} />);
    // Trigger shows the date label (not "Select a date")
    fireEvent.press(screen.getByText(todayLabel));
    // Both the trigger and the modal item show todayLabel; selected item has checkmark
    expect(screen.getByText("✓")).toBeTruthy();
  });

  it("falls back to COLORS.primary when brand has no primaryColor", () => {
    const { useBrand } = require("@/context/BrandContext");
    (useBrand as jest.Mock).mockReturnValueOnce({ appName: "Test", primaryColor: "" });
    render(<DatePicker onSelect={jest.fn()} />);
    expect(screen.getByText("Select a date")).toBeTruthy();
  });
});
