import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { Platform } from "react-native";
import DatePicker, { generateDateOptions, pickerRange } from "@/components/common/DatePicker";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
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

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });

/** Drives the mocked system control the way the real one reports a pick or a cancel. */
const reportPick = (picked?: Date, type: "set" | "dismissed" = "set") =>
  fireEvent(screen.getByTestId("date-picker-control"), "change", { type }, picked);

const openPicker = () => fireEvent.press(screen.getByLabelText(/^Select a date$|^Change date/));

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
    setPlatform("ios");
  });

  it("renders trigger with placeholder when no date selected", () => {
    render(<DatePicker onSelect={jest.fn()} />);
    expect(screen.getByText("Select a date")).toBeTruthy();
  });

  it("renders the selected date label", () => {
    render(<DatePicker selectedDate={todayStr} onSelect={jest.fn()} />);
    expect(screen.getByText(todayLabel)).toBeTruthy();
  });

  it("shows no control until the trigger is pressed", () => {
    render(<DatePicker onSelect={jest.fn()} />);
    expect(screen.queryByTestId("date-picker-control")).toBeNull();

    openPicker();
    expect(screen.getByTestId("date-picker-control")).toBeTruthy();
  });

  it("reports the picked day as a local YYYY-MM-DD and closes", () => {
    const onSelect = jest.fn();
    render(<DatePicker onSelect={onSelect} />);
    openPicker();

    reportPick(new Date(2026, 3, 17));

    expect(onSelect).toHaveBeenCalledWith("2026-04-17");
    expect(screen.queryByTestId("date-picker-control")).toBeNull();
  });

  // Android's cancel and iOS's backdrop both have to leave the caller's date alone.
  it("closes without selecting when the picker is dismissed", () => {
    const onSelect = jest.fn();
    render(<DatePicker onSelect={onSelect} />);
    openPicker();

    reportPick(undefined, "dismissed");

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByTestId("date-picker-control")).toBeNull();
  });

  it("opens on the selected date rather than on today", () => {
    render(<DatePicker selectedDate="2026-04-17" onSelect={jest.fn()} />);
    openPicker();

    expect(screen.getByTestId("date-picker-control").props.value).toEqual(new Date(2026, 3, 17));
  });

  it("opens on today when nothing is selected yet", () => {
    render(<DatePicker onSelect={jest.fn()} />);
    openPicker();

    const opened = screen.getByTestId("date-picker-control").props.value as Date;
    expect(localDateValue(opened)).toBe(todayStr);
  });

  it("names the selected date on the trigger even when it lies outside the offered window", () => {
    // A date filter spanning several locations, or a deep link, can hand us a day the venue is
    // shut on. Answering "Select a date" for a date the caller has selected reads as a control
    // that lost its value.
    render(<DatePicker selectedDate={todayStr} onSelect={jest.fn()} openDays={[]} />);

    expect(screen.getByLabelText(`Change date, currently ${todayLabel}`)).toBeTruthy();
  });

  /**
   * #423: the system calendar clamps to a range and cannot disable days inside it, so a closed
   * or walk-in-only day is now pickable and answered downstream (`booking.form.closedDayNotice`
   * in `BookingForm`, `WalkInDaysBanner` for the walk-in case) rather than by a day that was
   * never offered. Pinned so the trade is a decision, not a regression someone re-fixes here.
   */
  describe("days the venue cannot seat", () => {
    const isoDayOf = (d: Date) => (d.getDay() === 0 ? 7 : d.getDay());

    it("reports a closed day upward for the form downstream to explain", () => {
      const onSelect = jest.fn();
      render(<DatePicker onSelect={onSelect} openDays={[isoDayOf(today) === 7 ? 1 : 7]} />);
      openPicker();

      reportPick(today);

      expect(onSelect).toHaveBeenCalledWith(todayStr);
    });

    it("reports a walk-in-only day upward the same way", () => {
      const onSelect = jest.fn();
      render(
        <DatePicker
          onSelect={onSelect}
          unavailableDays={[isoDayOf(today)]}
          unavailableReason="Walk-ins only"
        />
      );
      openPicker();

      reportPick(today);

      expect(onSelect).toHaveBeenCalledWith(todayStr);
    });
  });

  describe("presentation per platform", () => {
    it("hosts the inline calendar in its own card on iOS", () => {
      render(<DatePicker onSelect={jest.fn()} />);
      openPicker();

      expect(screen.getByTestId("date-picker-control").props.display).toBe("inline");
      expect(screen.getByRole("header", { name: "Select a date" })).toBeTruthy();
    });

    // Android's picker presents its own dialog; a Modal around it would stack two.
    it("lets Android present its own dialog, with no card of ours around it", () => {
      setPlatform("android");
      render(<DatePicker onSelect={jest.fn()} />);
      openPicker();

      expect(screen.getByTestId("date-picker-control").props.display).toBe("default");
      expect(screen.queryByRole("header", { name: "Select a date" })).toBeNull();
    });

    it("keeps the picker open when the iOS card's own chrome is pressed", () => {
      render(<DatePicker onSelect={jest.fn()} />);
      openPicker();

      fireEvent.press(screen.getByRole("header", { name: "Select a date" }));

      expect(screen.getByTestId("date-picker-control")).toBeTruthy();
    });
  });

  // LocationsFilterBar drives the picker this way: a calendar glyph, and a label that says
  // "Today" rather than repeating the date.
  it("draws a leading glyph and an overriding label when given them", () => {
    render(
      <DatePicker
        selectedDate={todayStr}
        onSelect={jest.fn()}
        icon="calendar-outline"
        triggerLabel="Today"
      />
    );

    expect(screen.getByText("Today")).toBeTruthy();
    expect(screen.queryByText(todayLabel)).toBeNull();
    // The label is an override, not a replacement: the trigger still announces the real date.
    expect(screen.getByLabelText(`Change date, currently ${todayLabel}`)).toBeTruthy();
  });

  it("names the date on an icon trigger given no label to override it", () => {
    render(<DatePicker selectedDate={todayStr} onSelect={jest.fn()} icon="calendar-outline" />);

    expect(screen.getByText(todayLabel)).toBeTruthy();
  });

  it("falls back to the placeholder on an icon trigger with nothing selected", () => {
    render(<DatePicker onSelect={jest.fn()} icon="calendar-outline" />);

    expect(screen.getByText("Select a date")).toBeTruthy();
  });

  it("hands the system control the viewer's colour scheme", () => {
    const { useColorScheme } = require("@/hooks/use-color-scheme");
    (useColorScheme as jest.Mock).mockReturnValue("dark");
    try {
      render(<DatePicker onSelect={jest.fn()} />);
      openPicker();

      expect(screen.getByTestId("date-picker-control").props.themeVariant).toBe("dark");
    } finally {
      (useColorScheme as jest.Mock).mockReturnValue("light");
    }
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

    it("clamps the system control to today..+29 for a customer", () => {
      const { minimumDate, maximumDate } = pickerRange();
      const lastOffered = new Date();
      lastOffered.setDate(lastOffered.getDate() + 29);

      expect(localDateValue(minimumDate)).toBe(todayStr);
      expect(localDateValue(maximumDate)).toBe(localDateValue(lastOffered));
    });

    it("reaches a year back for an admin", () => {
      const yearAgo = new Date();
      yearAgo.setDate(yearAgo.getDate() - 365);

      expect(localDateValue(pickerRange(true).minimumDate)).toBe(localDateValue(yearAgo));
    });

    it("hands the range to the control it opens", () => {
      render(<DatePicker onSelect={jest.fn()} allowPast />);
      openPicker();

      const control = screen.getByTestId("date-picker-control");
      expect(control.props.minimumDate).toEqual(pickerRange(true).minimumDate);
      expect(control.props.maximumDate).toEqual(pickerRange(true).maximumDate);
    });
  });
});
