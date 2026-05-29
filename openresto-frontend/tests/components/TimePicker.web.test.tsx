/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, fireEvent, screen } from "@testing-library/react-native";
import TimePickerWeb from "@/components/common/TimePicker.web";

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Test App", primaryColor: "#000" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

describe("TimePicker Web", () => {
  const onSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders and calls onSelect when value changes", () => {
    const { getByTestId } = render(<TimePickerWeb selectedTime="19:00" onSelect={onSelect} />);

    const wrapper = getByTestId("time-picker-web");
    expect(wrapper).toBeTruthy();

    const input = (wrapper as any).children[0];
    fireEvent(input, "change", { target: { value: "20:00" } });
    expect(onSelect).toHaveBeenCalledWith("20:00");
  });

  it("fires onFocus and onBlur on the input", () => {
    const { getByTestId } = render(<TimePickerWeb selectedTime="19:00" onSelect={onSelect} />);
    const wrapper = getByTestId("time-picker-web");
    const input = (wrapper as any).children[0];
    fireEvent(input, "focus");
    fireEvent(input, "blur");
    expect(wrapper).toBeTruthy();
  });

  it("handles empty value in onChange", () => {
    const onSelect2 = jest.fn();
    const { getByTestId } = render(<TimePickerWeb selectedTime="19:00" onSelect={onSelect2} />);
    const wrapper = getByTestId("time-picker-web");
    const input = (wrapper as any).children[0];
    fireEvent(input, "change", { target: { value: "" } });
    expect(onSelect2).not.toHaveBeenCalled();
  });

  it("clamps time below minTime to minTime", () => {
    const { getByTestId } = render(
      <TimePickerWeb selectedTime="10:00" onSelect={onSelect} minTime="11:00" maxTime="22:00" />
    );
    const wrapper = getByTestId("time-picker-web");
    const input = (wrapper as any).children[0];
    // 08:00 is below minTime 11:00
    fireEvent(input, "change", { target: { value: "08:00" } });
    expect(onSelect).toHaveBeenCalledWith("11:00");
  });

  it("clamps time above maxTime to maxTime", () => {
    const { getByTestId } = render(
      <TimePickerWeb selectedTime="10:00" onSelect={onSelect} minTime="09:00" maxTime="20:00" />
    );
    const wrapper = getByTestId("time-picker-web");
    const input = (wrapper as any).children[0];
    // 23:00 is above maxTime 20:00
    fireEvent(input, "change", { target: { value: "23:00" } });
    expect(onSelect).toHaveBeenCalledWith("20:00");
  });

  it("renders without selectedTime (covers placeholder color branch)", () => {
    const { getByTestId } = render(<TimePickerWeb onSelect={onSelect} />);
    const wrapper = getByTestId("time-picker-web");
    expect(wrapper).toBeTruthy();
  });
});
