/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import TimePicker from "@/components/common/TimePicker";

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Test App", primaryColor: "#000" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

// Mock react-native
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  rn.Platform.OS = "ios";
  // Mock Modal to just render children
  rn.Modal = ({ children, visible }: any) => (visible ? children : null);
  return rn;
});

describe("TimePicker Native", () => {
  const onSelect = jest.fn();

  it("renders with time", () => {
    render(<TimePicker selectedTime="19:00" onSelect={onSelect} />);
    expect(screen.getByText("19:00")).toBeTruthy();
  });

  it("opens and selects time", () => {
    render(<TimePicker selectedTime="19:00" onSelect={onSelect} />);
    fireEvent.press(screen.getByText("19:00"));
    expect(screen.getByText("Select a time")).toBeTruthy();

    // Find a time slot and press it
    const timeSlot = screen.getByText("09:15");
    fireEvent.press(timeSlot);
    expect(onSelect).toHaveBeenCalledWith("09:15");
  });
});
