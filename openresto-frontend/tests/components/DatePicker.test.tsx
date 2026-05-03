import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import DatePicker from "@/components/common/DatePicker";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
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
});
