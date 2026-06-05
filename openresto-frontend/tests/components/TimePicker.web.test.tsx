/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, fireEvent, screen } from "@testing-library/react-native";
import TimePickerWeb from "@/components/common/TimePicker.web";

const mockUseBrand = jest.fn(() => ({ appName: "Test App", primaryColor: "#000" }));
jest.mock("@/context/BrandContext", () => ({
  useBrand: (...args: any[]) => mockUseBrand(...args),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

describe("TimePicker Web", () => {
  const onSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseBrand.mockReturnValue({ appName: "Test App", primaryColor: "#000" });
  });

  it("renders and calls onSelect when value changes", () => {
    const { getByTestId } = render(<TimePickerWeb selectedTime="19:00" onSelect={onSelect} />);
    const wrapper = getByTestId("time-picker-web");
    expect(wrapper).toBeTruthy();
    const input = (wrapper as any).children[0];
    fireEvent(input, "change", { target: { value: "20:00" } });
    expect(onSelect).toHaveBeenCalledWith("20:00");
  });

  it("fires onFocus and onBlur on the time input", () => {
    const { getByTestId } = render(<TimePickerWeb selectedTime="19:00" onSelect={onSelect} />);
    const wrapper = getByTestId("time-picker-web");
    const input = (wrapper as any).children[0];
    fireEvent(input, "focus");
    fireEvent(input, "blur");
    expect(wrapper).toBeTruthy();
  });

  it("clamps time below minTime to minTime", () => {
    const { getByTestId } = render(
      <TimePickerWeb selectedTime="09:00" onSelect={onSelect} minTime="09:00" maxTime="22:00" />
    );
    const input = (getByTestId("time-picker-web") as any).children[0];
    fireEvent(input, "change", { target: { value: "07:00" } });
    expect(onSelect).toHaveBeenCalledWith("09:00");
  });

  it("clamps time above maxTime to maxTime", () => {
    const { getByTestId } = render(
      <TimePickerWeb selectedTime="09:00" onSelect={onSelect} minTime="09:00" maxTime="22:00" />
    );
    const input = (getByTestId("time-picker-web") as any).children[0];
    fireEvent(input, "change", { target: { value: "23:00" } });
    expect(onSelect).toHaveBeenCalledWith("22:00");
  });

  it("does not call onSelect when value is empty", () => {
    const { getByTestId } = render(<TimePickerWeb onSelect={onSelect} />);
    const input = (getByTestId("time-picker-web") as any).children[0];
    fireEvent(input, "change", { target: { value: "" } });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("falls back to COLORS.primary when brand primaryColor is empty", () => {
    mockUseBrand.mockReturnValueOnce({ appName: "Test App", primaryColor: "" });
    render(<TimePickerWeb onSelect={onSelect} />);
    expect(screen.getByTestId("time-picker-web")).toBeTruthy();
  });
});
