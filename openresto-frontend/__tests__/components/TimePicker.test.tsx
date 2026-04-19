import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import TimePicker from "@/components/common/TimePicker";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Open Resto", primaryColor: "#0a7ea4" }),
}));

describe("TimePicker (native)", () => {
  it("renders trigger with placeholder when no time selected", () => {
    render(<TimePicker onSelect={jest.fn()} />);
    expect(screen.getByText("Select a time")).toBeTruthy();
  });

  it("renders the selected time label", () => {
    render(<TimePicker selectedTime="14:00" onSelect={jest.fn()} />);
    expect(screen.getByText("14:00")).toBeTruthy();
  });

  it("opens modal when trigger is pressed and shows options", () => {
    render(<TimePicker onSelect={jest.fn()} minTime="09:00" maxTime="10:00" />);
    fireEvent.press(screen.getByText("Select a time"));
    expect(screen.getByText("09:00")).toBeTruthy();
  });

  it("calls onSelect when a time slot is selected", () => {
    const onSelect = jest.fn();
    render(<TimePicker onSelect={onSelect} minTime="09:00" maxTime="10:00" />);
    fireEvent.press(screen.getByText("Select a time"));
    fireEvent.press(screen.getByText("09:00"));
    expect(onSelect).toHaveBeenCalledWith("09:00");
  });

  it("renders chevron indicator", () => {
    render(<TimePicker onSelect={jest.fn()} />);
    expect(screen.getByText("▾")).toBeTruthy();
  });

  it("does not show times before minTime", () => {
    render(<TimePicker onSelect={jest.fn()} minTime="14:00" maxTime="16:00" />);
    fireEvent.press(screen.getByText("Select a time"));
    expect(screen.queryByText("13:00")).toBeNull();
    expect(screen.getByText("14:00")).toBeTruthy();
  });
});
