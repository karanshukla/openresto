/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { haptics } from "@/utils/haptics";
import Stepper from "@/components/common/Stepper";

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

jest.mock("@/utils/haptics", () => ({
  haptics: { selection: jest.fn(), press: jest.fn(), outcome: jest.fn() },
}));

const OPTIONS = [
  { label: "1 guest", value: 1 },
  { label: "2 guests", value: 2 },
  { label: "3 guests", value: 3 },
];

const labels = {
  accessibilityLabel: "Number of guests",
  decrementLabel: "One fewer guest",
  incrementLabel: "One more guest",
};

const renderStepper = (value: number | string, onChange = jest.fn()) => {
  render(<Stepper options={OPTIONS} value={value} onChange={onChange} {...labels} />);
  return onChange;
};

describe("Stepper", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows the label of the option holding the current value", () => {
    renderStepper(2);
    expect(screen.getByText("2 guests")).toBeTruthy();
  });

  it("steps to the next option in the list", () => {
    const onChange = renderStepper(2);
    fireEvent.press(screen.getByLabelText("One more guest"));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("steps to the previous option in the list", () => {
    const onChange = renderStepper(2);
    fireEvent.press(screen.getByLabelText("One fewer guest"));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("ticks a haptic on each step", () => {
    renderStepper(2);
    fireEvent.press(screen.getByLabelText("One more guest"));
    expect(haptics.selection).toHaveBeenCalledTimes(1);
  });

  it("disables the minus button on the first option", () => {
    renderStepper(1);
    expect(screen.getByLabelText("One fewer guest").props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText("One more guest").props.accessibilityState.disabled).toBe(false);
  });

  it("disables the plus button on the last option", () => {
    renderStepper(3);
    expect(screen.getByLabelText("One more guest").props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText("One fewer guest").props.accessibilityState.disabled).toBe(false);
  });

  /**
   * The buttons at the ends are disabled, but the adjustable role's own increment and
   * decrement actions are not — so the bounds are enforced by the step itself, not only by
   * the control that is showing.
   */
  it("steps nowhere off either end of the list", () => {
    const onChange = renderStepper(3);
    fireEvent(screen.getByLabelText("Number of guests"), "accessibilityAction", {
      nativeEvent: { actionName: "increment" },
    });
    expect(onChange).not.toHaveBeenCalled();
    expect(haptics.selection).not.toHaveBeenCalled();

    screen.rerender(<Stepper options={OPTIONS} value={1} onChange={onChange} {...labels} />);
    fireEvent(screen.getByLabelText("Number of guests"), "accessibilityAction", {
      nativeEvent: { actionName: "decrement" },
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables both buttons for a value the list does not offer", () => {
    renderStepper(99);
    expect(screen.getByLabelText("One fewer guest").props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText("One more guest").props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText("99")).toBeTruthy();
  });

  it("is an adjustable control announcing the value it holds", () => {
    renderStepper(2);
    const control = screen.getByLabelText("Number of guests");
    expect(control.props.accessibilityValue).toEqual({ text: "2 guests" });
    expect(control.props.accessibilityActions).toEqual([
      { name: "increment" },
      { name: "decrement" },
    ]);
  });

  it("responds to the increment and decrement accessibility actions", () => {
    const onChange = renderStepper(2);
    const control = screen.getByLabelText("Number of guests");
    fireEvent(control, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    expect(onChange).toHaveBeenCalledWith(3);
    fireEvent(control, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
    expect(onChange).toHaveBeenCalledWith(1);
  });
});
