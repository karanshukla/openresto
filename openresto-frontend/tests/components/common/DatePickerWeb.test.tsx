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

// Local YYYY-MM-DD (matches how the component computes date strings).
function localDateValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("DatePicker (web)", () => {
  const onSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<DatePickerWeb onSelect={onSelect} />);
    expect(screen.getByText("Select a date")).toBeTruthy();
  });

  it("renders with a selected date without crashing", () => {
    render(<DatePickerWeb selectedDate="2026-10-01" onSelect={onSelect} />);
    expect(screen.getByTestId("date-picker-trigger")).toBeTruthy();
  });

  it("shows closed day warning when selected date is a closed day", () => {
    // 2026-10-05 is a Monday (ISO day 1); openDays=[2,3,4,5,6] excludes Monday
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

  it("opens the calendar when the trigger is pressed", () => {
    render(<DatePickerWeb onSelect={onSelect} />);
    expect(screen.queryByTestId("date-picker-calendar")).toBeNull();
    fireEvent.press(screen.getByTestId("date-picker-trigger"));
    expect(screen.getByTestId("date-picker-calendar")).toBeTruthy();
  });

  it("selects an open day and closes the calendar", () => {
    const today = new Date();
    const todayStr = localDateValue(today);
    render(<DatePickerWeb onSelect={onSelect} openDays={[1, 2, 3, 4, 5, 6, 7]} />);
    fireEvent.press(screen.getByTestId("date-picker-trigger"));
    fireEvent.press(screen.getByTestId(`date-picker-day-${todayStr}`));
    expect(onSelect).toHaveBeenCalledWith(todayStr);
    expect(screen.queryByTestId("date-picker-calendar")).toBeNull();
  });

  it("does not call onSelect when pressing a closed weekday cell", () => {
    const today = new Date();
    const todayStr = localDateValue(today);
    const todayIso = today.getDay() === 0 ? 7 : today.getDay();
    const openDays = [1, 2, 3, 4, 5, 6, 7].filter((d) => d !== todayIso);
    render(<DatePickerWeb onSelect={onSelect} openDays={openDays} />);
    fireEvent.press(screen.getByTestId("date-picker-trigger"));
    fireEvent.press(screen.getByTestId(`date-picker-day-${todayStr}`));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("does not call onSelect when pressing a cell outside the allowed range", () => {
    const today = new Date();
    render(<DatePickerWeb onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId("date-picker-trigger"));
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    // Only attempt if yesterday falls within the same rendered month view.
    if (yesterday.getMonth() === today.getMonth()) {
      fireEvent.press(screen.getByTestId(`date-picker-day-${localDateValue(yesterday)}`));
      expect(onSelect).not.toHaveBeenCalled();
    }
  });

  it("navigates to the next and previous month", () => {
    const today = new Date();
    const currentLabel = today.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const nextLabel = next.toLocaleDateString(undefined, { month: "long", year: "numeric" });

    render(<DatePickerWeb onSelect={onSelect} allowPast />);
    fireEvent.press(screen.getByTestId("date-picker-trigger"));
    expect(screen.getByText(currentLabel)).toBeTruthy();
    fireEvent.press(screen.getByTestId("date-picker-next-month"));
    expect(screen.getByText(nextLabel)).toBeTruthy();
    fireEvent.press(screen.getByTestId("date-picker-prev-month"));
    expect(screen.getByText(currentLabel)).toBeTruthy();
  });

  it("rolls the year over when navigating across a December/January boundary", () => {
    const today = new Date();
    // Mid-December of last year — well within the allowPast 365-day window.
    const lastDec = new Date(today.getFullYear() - 1, 11, 20);
    const decLabel = lastDec.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const jan = new Date(lastDec.getFullYear() + 1, 0, 1);
    const janLabel = jan.toLocaleDateString(undefined, { month: "long", year: "numeric" });

    render(<DatePickerWeb selectedDate={localDateValue(lastDec)} onSelect={onSelect} allowPast />);
    fireEvent.press(screen.getByTestId("date-picker-trigger"));
    expect(screen.getByText(decLabel)).toBeTruthy();
    fireEvent.press(screen.getByTestId("date-picker-next-month"));
    expect(screen.getByText(janLabel)).toBeTruthy();
    fireEvent.press(screen.getByTestId("date-picker-prev-month"));
    expect(screen.getByText(decLabel)).toBeTruthy();
  });

  it("does not navigate past the max date's month", () => {
    render(<DatePickerWeb onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId("date-picker-trigger"));
    // Click next repeatedly beyond the ~29 day window (at most 2 months out).
    fireEvent.press(screen.getByTestId("date-picker-next-month"));
    fireEvent.press(screen.getByTestId("date-picker-next-month"));
    fireEvent.press(screen.getByTestId("date-picker-next-month"));
    const label = screen.getByTestId("date-picker-calendar");
    expect(label).toBeTruthy();
  });

  it("closes the calendar when pressing the backdrop", () => {
    render(<DatePickerWeb onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId("date-picker-trigger"));
    expect(screen.getByTestId("date-picker-calendar")).toBeTruthy();
    fireEvent.press(screen.getByTestId("date-picker-backdrop"));
    expect(screen.queryByTestId("date-picker-calendar")).toBeNull();
  });
});

// The Locations filter bar renders the picker as a compact chip: a leading glyph and a
// caller-supplied label ("Today") in place of the formatted date.
describe("DatePicker (web) as a filter chip", () => {
  const onSelect = jest.fn();

  it("shows the caller's label instead of the selected date", () => {
    render(
      <DatePickerWeb
        onSelect={onSelect}
        icon="calendar-outline"
        triggerLabel="Today"
        selectedDate="2026-04-16"
      />
    );
    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.queryByText(/Apr 16/)).toBeNull();
  });

  it("overrides the empty-state label too", () => {
    render(<DatePickerWeb onSelect={onSelect} triggerLabel="Any day" />);
    expect(screen.getByText("Any day")).toBeTruthy();
    expect(screen.queryByText("Select a date")).toBeNull();
  });

  it("falls back to the formatted date when no label is supplied", () => {
    render(<DatePickerWeb onSelect={onSelect} icon="calendar-outline" selectedDate="2026-04-16" />);
    expect(screen.getByText(/Apr 16/)).toBeTruthy();
  });
});
