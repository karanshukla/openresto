/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { Modal } from "react-native";
import TimePicker, { generateTimeOptions } from "@/components/common/TimePicker";
import { useBrand } from "@/context/BrandContext";

jest.mock("@/context/BrandContext", () => ({
  useBrand: jest.fn(() => ({ appName: "Test App", primaryColor: "#000" })),
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

  it("renders placeholder text when no time is selected", () => {
    render(<TimePicker onSelect={onSelect} />);
    expect(screen.getByText("Select a time")).toBeTruthy();
  });

  it("shows checkmark for currently selected time option", () => {
    render(<TimePicker selectedTime="09:00" onSelect={onSelect} />);
    fireEvent.press(screen.getByText("09:00"));
    // The selected option renders a checkmark
    expect(screen.getByText("✓")).toBeTruthy();
  });

  it("closes the modal when the backdrop is pressed", () => {
    render(<TimePicker selectedTime="09:00" onSelect={onSelect} />);
    fireEvent.press(screen.getByText("09:00"));
    expect(screen.getByText("Select a time")).toBeTruthy();
    fireEvent.press(screen.getByTestId("time-picker-backdrop"));
    expect(screen.queryByText("Select a time")).toBeNull();
  });

  it("closes the modal when onRequestClose fires (e.g. Android back button)", () => {
    render(<TimePicker selectedTime="09:00" onSelect={onSelect} />);
    fireEvent.press(screen.getByText("09:00"));
    expect(screen.getByText("Select a time")).toBeTruthy();
    act(() => {
      screen.UNSAFE_getByType(Modal).props.onRequestClose();
    });
    expect(screen.queryByText("Select a time")).toBeNull();
  });

  it("falls back to the default primary color when the brand has none", () => {
    (useBrand as jest.Mock).mockReturnValueOnce({ appName: "Test App", primaryColor: "" });
    render(<TimePicker selectedTime="09:00" onSelect={onSelect} />);
    expect(screen.getByText("09:00")).toBeTruthy();
  });

  it("highlights the trigger border when hovered", () => {
    render(<TimePicker selectedTime="09:00" onSelect={onSelect} />);
    let node = screen.getByText("09:00").parent;
    while (node && typeof node.props?.style !== "function") {
      node = node.parent;
    }
    const styleFn = node?.props.style as (state: { hovered: boolean }) => unknown;
    expect(typeof styleFn).toBe("function");
    const hoveredStyle = styleFn({ hovered: true });
    expect(hoveredStyle).toContainEqual({ borderColor: "#000" });
  });
});

describe("generateTimeOptions", () => {
  it("defaults to a 09:00-22:00 range when called with no arguments", () => {
    const options = generateTimeOptions();
    expect(options[0]).toEqual({ label: "09:00", value: "09:00" });
    expect(options[options.length - 1]).toEqual({ label: "22:00", value: "22:00" });
  });
});
