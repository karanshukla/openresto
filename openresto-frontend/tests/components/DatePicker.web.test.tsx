/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, fireEvent, screen } from "@testing-library/react-native";
import DatePickerWeb from "@/components/common/DatePicker.web";

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ appName: "Test App", primaryColor: "#007AFF" }),
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

describe("DatePicker Web", () => {
  const onSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    const { toJSON } = render(
      <DatePickerWeb selectedDate="2026-06-15" onSelect={onSelect} />
    );
    expect(toJSON()).toBeDefined();
  });

  it("calls onSelect when date changes", () => {
    const { UNSAFE_getAllByType } = render(
      <DatePickerWeb selectedDate="2026-06-15" onSelect={onSelect} />
    );
    const inputs = UNSAFE_getAllByType("input" as any);
    expect(inputs.length).toBeGreaterThan(0);
    fireEvent(inputs[0], "change", { target: { value: "2026-07-01" } });
    expect(onSelect).toHaveBeenCalledWith("2026-07-01");
  });

  it("fires onFocus and onBlur on the input", () => {
    const { UNSAFE_getAllByType } = render(
      <DatePickerWeb selectedDate="2026-06-15" onSelect={onSelect} />
    );
    const inputs = UNSAFE_getAllByType("input" as any);
    fireEvent(inputs[0], "focus");
    fireEvent(inputs[0], "blur");
    expect(inputs[0]).toBeTruthy();
  });

  it("renders without selected date", () => {
    const { toJSON } = render(<DatePickerWeb onSelect={onSelect} />);
    expect(toJSON()).toBeDefined();
  });

  it("shows closed day warning when selected day is not in openDays", () => {
    // 2026-06-13 is a Saturday (isoDay=6), openDays has only Mon-Fri (1-5)
    render(
      <DatePickerWeb
        selectedDate="2026-06-13"
        onSelect={onSelect}
        openDays={[1, 2, 3, 4, 5]}
      />
    );
    expect(
      screen.getByText(/This restaurant is normally closed on this day/)
    ).toBeTruthy();
  });

  it("does not show closed day warning when day is in openDays", () => {
    // 2026-06-15 is a Monday (isoDay=1), in openDays
    render(
      <DatePickerWeb
        selectedDate="2026-06-15"
        onSelect={onSelect}
        openDays={[1, 2, 3, 4, 5]}
      />
    );
    expect(
      screen.queryByText(/This restaurant is normally closed on this day/)
    ).toBeNull();
  });

  it("does not show warning when openDays is not provided", () => {
    render(
      <DatePickerWeb selectedDate="2026-06-13" onSelect={onSelect} />
    );
    expect(
      screen.queryByText(/This restaurant is normally closed on this day/)
    ).toBeNull();
  });

  it("shows warning for a Sunday (isoDay=7) when Sundays are closed", () => {
    // 2026-06-14 is a Sunday (jsDay=0 → isoDay=7)
    render(
      <DatePickerWeb
        selectedDate="2026-06-14"
        onSelect={onSelect}
        openDays={[1, 2, 3, 4, 5, 6]}
      />
    );
    expect(
      screen.getByText(/This restaurant is normally closed on this day/)
    ).toBeTruthy();
  });
});
