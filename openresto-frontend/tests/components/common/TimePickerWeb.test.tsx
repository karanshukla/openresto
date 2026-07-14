/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import TimePicker from "@/components/common/TimePicker.web";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

describe("TimePicker (web)", () => {
  const onSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<TimePicker onSelect={onSelect} />);
    expect(screen.getByTestId("time-picker-web")).toBeTruthy();
  });

  it("shows a placeholder when no time is selected", () => {
    render(<TimePicker onSelect={onSelect} />);
    expect(screen.getByText("Select a time")).toBeTruthy();
  });

  it("shows the selected time on the trigger", () => {
    render(<TimePicker selectedTime="14:00" onSelect={onSelect} />);
    expect(screen.getByTestId("time-picker-trigger")).toBeTruthy();
    expect(screen.getByText("14:00")).toBeTruthy();
  });

  it("opens the dropdown when the trigger is pressed", () => {
    render(<TimePicker onSelect={onSelect} />);
    expect(screen.queryByTestId("time-picker-panel")).toBeNull();
    fireEvent.press(screen.getByTestId("time-picker-trigger"));
    expect(screen.getByTestId("time-picker-panel")).toBeTruthy();
  });

  it("selects a time option and closes the dropdown", () => {
    render(<TimePicker onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId("time-picker-trigger"));
    fireEvent.press(screen.getByTestId("time-picker-option-09:15"));
    expect(onSelect).toHaveBeenCalledWith("09:15");
    expect(screen.queryByTestId("time-picker-panel")).toBeNull();
  });

  it("closes the dropdown when pressing the backdrop", () => {
    render(<TimePicker onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId("time-picker-trigger"));
    expect(screen.getByTestId("time-picker-panel")).toBeTruthy();
    fireEvent.press(screen.getByTestId("time-picker-backdrop"));
    expect(screen.queryByTestId("time-picker-panel")).toBeNull();
  });

  it("restricts options to the given minTime/maxTime range", () => {
    render(<TimePicker onSelect={onSelect} minTime="08:00" maxTime="09:30" />);
    fireEvent.press(screen.getByTestId("time-picker-trigger"));
    expect(screen.getByTestId("time-picker-option-08:00")).toBeTruthy();
    expect(screen.getByTestId("time-picker-option-09:30")).toBeTruthy();
    expect(screen.queryByTestId("time-picker-option-07:45")).toBeNull();
    expect(screen.queryByTestId("time-picker-option-09:45")).toBeNull();
  });

  it("marks the currently selected option with a checkmark", () => {
    render(<TimePicker selectedTime="09:00" onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId("time-picker-trigger"));
    expect(screen.getByText("✓")).toBeTruthy();
  });

  it("does not close the dropdown when pressing inside the panel", () => {
    render(<TimePicker onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId("time-picker-trigger"));
    fireEvent.press(screen.getByTestId("time-picker-panel"));
    expect(screen.getByTestId("time-picker-panel")).toBeTruthy();
  });
});
