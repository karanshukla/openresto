/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, fireEvent, screen } from "@testing-library/react-native";
import DatePickerWeb from "@/components/common/DatePicker.web";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/context/BrandContext", () => {
  const brand = { primaryColor: "#0a7ea4", appName: "Open Resto" };
  return { useBrand: () => brand };
});

describe("DatePicker (web)", () => {
  const onSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<DatePickerWeb onSelect={onSelect} />);
    expect(true).toBeTruthy();
  });

  it("renders with a selected date without crashing", () => {
    render(<DatePickerWeb selectedDate="2026-10-01" onSelect={onSelect} />);
    expect(true).toBeTruthy();
  });

  it("shows closed day warning when selected date is a closed day", () => {
    // ISO day: Monday=1, Tuesday=2, ... Saturday=6, Sunday=7
    // 2026-10-05 is a Monday (ISO day 1)
    // openDays=[2,3,4,5,6] means only Tue-Sat open → Monday is closed
    render(
      <DatePickerWeb selectedDate="2026-10-05" onSelect={onSelect} openDays={[2, 3, 4, 5, 6]} />
    );
    expect(screen.getByText(/normally closed on this day/)).toBeTruthy();
  });

  it("does not show closed day warning when selected date is an open day", () => {
    // 2026-10-06 is a Tuesday (ISO day 2) — open
    render(
      <DatePickerWeb selectedDate="2026-10-06" onSelect={onSelect} openDays={[2, 3, 4, 5, 6]} />
    );
    expect(screen.queryByText(/normally closed on this day/)).toBeNull();
  });

  it("does not show closed day warning when openDays is not provided", () => {
    render(<DatePickerWeb selectedDate="2026-10-05" onSelect={onSelect} />);
    expect(screen.queryByText(/normally closed on this day/)).toBeNull();
  });

  it("does not show closed day warning when no date is selected", () => {
    render(<DatePickerWeb onSelect={onSelect} openDays={[2, 3]} />);
    expect(screen.queryByText(/normally closed on this day/)).toBeNull();
  });

  it("calls onSelect when date value changes", () => {
    const { getByTestId } = render(<DatePickerWeb onSelect={onSelect} />);
    const wrapper = getByTestId("date-picker-web");
    const input = (wrapper as any).children[0];
    fireEvent(input, "change", { target: { value: "2026-11-15" } });
    expect(onSelect).toHaveBeenCalledWith("2026-11-15");
  });

  it("fires onFocus and onBlur on the date input", () => {
    const { getByTestId } = render(<DatePickerWeb onSelect={onSelect} />);
    const wrapper = getByTestId("date-picker-web");
    const input = (wrapper as any).children[0];
    fireEvent(input, "focus");
    fireEvent(input, "blur");
    expect(wrapper).toBeTruthy();
  });

  // Local YYYY-MM-DD (matches how the component computes the `min`/`max` bounds).
  function localDateValue(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  it("sets min to today by default (customer-flow restriction)", () => {
    const { getByTestId } = render(<DatePickerWeb onSelect={onSelect} />);
    const wrapper = getByTestId("date-picker-web");
    // The <input> is a react-test-renderer host instance, not a DOM node — read
    // its props rather than a DOM attribute (no `as any`; cast via `unknown`).
    const input = wrapper.children[0] as unknown as { props: { min?: string } };
    expect(input.props.min).toBe(localDateValue(new Date()));
  });

  it("relaxes min to at most today-365 when allowPast is set", () => {
    const { getByTestId } = render(<DatePickerWeb onSelect={onSelect} allowPast />);
    const wrapper = getByTestId("date-picker-web");
    const input = wrapper.children[0] as unknown as { props: { min?: string } };
    const min = input.props.min;
    expect(min).toBeTruthy();
    const yearAgo = new Date();
    yearAgo.setDate(yearAgo.getDate() - 365);
    // Absent OR a date at/before today-365 — either is an acceptable relaxation.
    expect(min! <= localDateValue(yearAgo)).toBe(true);
  });
});
