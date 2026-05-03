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

  it("renders and calls onSelect when value changes", () => {
    const { getByTestId } = render(<TimePickerWeb selectedTime="19:00" onSelect={onSelect} />);

    // Find the wrapper
    const wrapper = getByTestId("time-picker-web");
    expect(wrapper).toBeTruthy();

    // Find the input inside the wrapper's host element
    // This is a bit of a hack but should work in jsdom with RNTL
    const input = (wrapper as any).children[0];
    // fireEvent might work directly on it
    fireEvent(input, "change", { target: { value: "20:00" } });
    expect(onSelect).toHaveBeenCalledWith("20:00");
  });
});
