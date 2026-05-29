/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";
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

  it("renders with a selected time", () => {
    render(<TimePicker selectedTime="14:00" onSelect={onSelect} />);
    expect(screen.getByTestId("time-picker-web")).toBeTruthy();
  });

  it("renders with no selected time (empty state)", () => {
    render(<TimePicker onSelect={onSelect} />);
    expect(screen.getByTestId("time-picker-web")).toBeTruthy();
  });

  it("accepts custom minTime and maxTime props", () => {
    render(<TimePicker selectedTime="10:00" onSelect={onSelect} minTime="08:00" maxTime="20:00" />);
    expect(screen.getByTestId("time-picker-web")).toBeTruthy();
  });
});
