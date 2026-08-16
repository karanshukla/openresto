import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import DatePicker, { generateDateOptions } from "@/components/common/DatePicker";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: jest.fn(() => ({ appName: "Test App", primaryColor: "#0a7ea4" })),
}));

// Local YYYY-MM-DD (matches how the component formats option values).
// NB: must use local date parts (not `toISOString`, which is UTC) so the test
// agrees with the component's local `getDate()`/`getMonth()` formatting even
// when run in a timezone behind UTC near midnight.
function localDateValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Local short label (weekday, month, day) — same formatter the component uses.
function localDateLabel(d: Date): string {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

describe("DatePicker (native)", () => {
  // Snapshot today once per test (not once per module load) so a long-running
  // file never drifts past midnight between capture and render.
  let today: Date;
  let todayStr: string;
  let todayLabel: string;
  beforeEach(() => {
    today = new Date();
    todayStr = localDateValue(today);
    todayLabel = localDateLabel(today);
  });

  it("renders trigger with placeholder when no date selected", () => {
    render(<DatePicker onSelect={jest.fn()} />);
    expect(screen.getByText("Select a date")).toBeTruthy();
  });

  it("renders the selected date label", () => {
    render(<DatePicker selectedDate={todayStr} onSelect={jest.fn()} />);
    expect(screen.getByText(todayLabel)).toBeTruthy();
  });

  it("opens modal when trigger is pressed", () => {
    render(<DatePicker onSelect={jest.fn()} />);
    fireEvent.press(screen.getByText("Select a date"));
    // Modal title is also "Select a date" in the modal header
    // Options should be visible now
    expect(screen.getByText(todayLabel)).toBeTruthy();
  });

  it("calls onSelect when a date is selected", () => {
    const onSelect = jest.fn();
    render(<DatePicker onSelect={onSelect} />);
    fireEvent.press(screen.getByText("Select a date"));
    fireEvent.press(screen.getByText(todayLabel));
    expect(onSelect).toHaveBeenCalledWith(todayStr);
  });

  it("filters date options to open days only", () => {
    render(<DatePicker onSelect={jest.fn()} openDays={[1, 2, 3, 4, 5]} />);
    expect(screen.getByText("Select a date")).toBeTruthy();
  });

  describe("days that are listed but cannot be picked", () => {
    // The ISO day of today, so the fixtures below always hit the currently-selected date.
    const isoDayOf = (d: Date) => (d.getDay() === 0 ? 7 : d.getDay());

    it("still names the selected date on the trigger when that day isn't offered", () => {
      // A walk-in-only day or a closed day can arrive from a deep link or a list-wide date
      // filter. Answering "Select a date" for a date the caller has selected reads as a
      // control that lost its value.
      render(
        <DatePicker
          selectedDate={todayStr}
          onSelect={jest.fn()}
          openDays={[isoDayOf(today) === 7 ? 1 : isoDayOf(today) + 1]}
        />
      );
      expect(screen.getByLabelText(`Change date, currently ${todayLabel}`)).toBeTruthy();
    });

    it("lists an unavailable day with its reason instead of dropping it", () => {
      render(
        <DatePicker
          onSelect={jest.fn()}
          unavailableDays={[isoDayOf(today)]}
          unavailableReason="Walk-ins only"
        />
      );
      fireEvent.press(screen.getByText("Select a date"));
      expect(screen.getByLabelText(`${todayLabel}, Walk-ins only`)).toBeTruthy();
    });

    it("neither selects nor dismisses when an unavailable day is pressed", () => {
      // The press has to die on the row. Left to bubble, the backdrop's dismiss handler
      // closes the picker, which looks like the date control refusing to work at all.
      const onSelect = jest.fn();
      render(
        <DatePicker
          onSelect={onSelect}
          unavailableDays={[isoDayOf(today)]}
          unavailableReason="Walk-ins only"
        />
      );
      fireEvent.press(screen.getByText("Select a date"));
      fireEvent.press(screen.getByLabelText(`${todayLabel}, Walk-ins only`));

      expect(onSelect).not.toHaveBeenCalled();
      expect(screen.getByLabelText(`${todayLabel}, Walk-ins only`)).toBeTruthy();
    });

    it("keeps the picker open when its own chrome is pressed", () => {
      render(<DatePicker onSelect={jest.fn()} />);
      fireEvent.press(screen.getByText("Select a date"));
      fireEvent.press(screen.getByRole("header", { name: "Select a date" }));
      expect(screen.getByLabelText(todayLabel)).toBeTruthy();
    });
  });

  it("shows selected item styling when modal is open with pre-selected date", () => {
    render(<DatePicker selectedDate={todayStr} onSelect={jest.fn()} />);
    // Trigger shows the date label (not "Select a date")
    fireEvent.press(screen.getByText(todayLabel));
    // Both the trigger and the modal item show todayLabel; selected item has checkmark
    expect(screen.getByText("✓", { includeHiddenElements: true })).toBeTruthy();
  });

  it("falls back to COLORS.primary when brand has no primaryColor", () => {
    const { useBrand } = require("@/context/BrandContext");
    (useBrand as jest.Mock).mockReturnValueOnce({ appName: "Test", primaryColor: "" });
    render(<DatePicker onSelect={jest.fn()} />);
    expect(screen.getByText("Select a date")).toBeTruthy();
  });

  describe("allowPast prop (admin back-dating — #160)", () => {
    it("excludes past dates by default (customer-flow regression guard)", () => {
      const options = generateDateOptions();
      const todayValue = localDateValue(new Date());
      // Earliest option is exactly today; no option is before today.
      expect(options[0].value).toBe(todayValue);
      expect(options.every((o) => o.value >= todayValue)).toBe(true);
      expect(options).toHaveLength(30);
    });

    it("includes past dates when allowPast is set", () => {
      const options = generateDateOptions({ allowPast: true });
      const todayValue = localDateValue(new Date());
      const pastOption = options.find((o) => o.value < todayValue);
      expect(pastOption).toBeTruthy();
      // Bounded to today-365 .. today+29 inclusive.
      const yearAgo = new Date();
      yearAgo.setDate(yearAgo.getDate() - 365);
      expect(options[0].value).toBe(localDateValue(yearAgo));
      expect(options).toHaveLength(365 + 29 + 1);
    });

    it("renders without crashing when allowPast is passed", () => {
      render(<DatePicker onSelect={jest.fn()} allowPast />);
      fireEvent.press(screen.getByText("Select a date"));
      expect(screen.getAllByText("Select a date").length).toBeGreaterThan(0);
    });
  });
});
