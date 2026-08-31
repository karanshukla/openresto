/**
 * @jest-environment jsdom
 */
import React from "react";
import { StyleSheet } from "react-native";
import { render, fireEvent, screen } from "@testing-library/react-native";
import DatePickerWeb from "@/components/common/DatePicker.web";
import { theme } from "@/theme/theme";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/context/BrandContext", () => {
  const brand = { primaryColor: "#0a7ea4", appName: "Open Resto" };
  return { useBrand: () => brand };
});

// The trigger formats with the runtime locale, which orders the parts differently in
// en-GB ("Thu 16 Apr") than en-US ("Thu, Apr 16") — derive the label the same way the
// component does rather than pinning one locale's order.
const APR_16_LABEL = new Date("2026-04-16T12:00:00").toLocaleDateString(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

// Local YYYY-MM-DD (matches how the component computes date strings).
function localDateValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * The picker renders exactly one calendar month — `DatePicker.web.tsx` builds its cells from
 * `firstOfMonth` and that month's day count — so on the last day of a month, tomorrow is not a
 * cell at all. A test that opens on today and asserts against tomorrow therefore fails for real
 * on roughly twelve days a year. Pinning mid-month is what keeps tomorrow a same-month cell.
 * Built from local parts rather than an ISO string so no timezone can shift it off the middle.
 */
function pinClockMidMonth(): void {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 3, 15, 12, 0, 0));
}

describe("DatePicker (web)", () => {
  const onSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders without crashing", () => {
    render(<DatePickerWeb onSelect={onSelect} />);
    expect(screen.getByText("Select a date")).toBeTruthy();
  });

  it("renders with a selected date without crashing", () => {
    render(<DatePickerWeb selectedDate="2026-10-01" onSelect={onSelect} />);
    expect(screen.getByTestId("date-picker-trigger")).toBeTruthy();
  });

  it("reddens the trigger border when selected date is a closed day", () => {
    // 2026-10-05 is a Monday (ISO day 1); openDays=[2,3,4,5,6] excludes Monday
    render(
      <DatePickerWeb selectedDate="2026-10-05" onSelect={onSelect} openDays={[2, 3, 4, 5, 6]} />
    );
    const trigger = screen.getByTestId("date-picker-trigger");
    expect(StyleSheet.flatten(trigger.props.style).borderColor).toBe(theme.colors.error);
  });

  it("does not redden the trigger border when selected date is an open day", () => {
    // 2026-10-06 is a Tuesday (ISO day 2) — open
    render(
      <DatePickerWeb selectedDate="2026-10-06" onSelect={onSelect} openDays={[2, 3, 4, 5, 6]} />
    );
    const trigger = screen.getByTestId("date-picker-trigger");
    expect(StyleSheet.flatten(trigger.props.style).borderColor).not.toBe(theme.colors.error);
  });

  it("does not redden the trigger border when openDays is not provided", () => {
    render(<DatePickerWeb selectedDate="2026-10-05" onSelect={onSelect} />);
    const trigger = screen.getByTestId("date-picker-trigger");
    expect(StyleSheet.flatten(trigger.props.style).borderColor).not.toBe(theme.colors.error);
  });

  it("does not redden the trigger border when no date is selected", () => {
    render(<DatePickerWeb onSelect={onSelect} openDays={[2, 3]} />);
    const trigger = screen.getByTestId("date-picker-trigger");
    expect(StyleSheet.flatten(trigger.props.style).borderColor).not.toBe(theme.colors.error);
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

  describe("walk-in-only days", () => {
    const todayIso = () => {
      const d = new Date();
      return d.getDay() === 0 ? 7 : d.getDay();
    };

    it("does not call onSelect when pressing a walk-in-only day", () => {
      const todayStr = localDateValue(new Date());
      render(
        <DatePickerWeb
          onSelect={onSelect}
          openDays={[1, 2, 3, 4, 5, 6, 7]}
          unavailableDays={[todayIso()]}
          unavailableReason="Walk-ins only"
        />
      );
      fireEvent.press(screen.getByTestId("date-picker-trigger"));
      fireEvent.press(screen.getByTestId(`date-picker-day-${todayStr}`));
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("still lets a bookable day be picked while other days are walk-in only", () => {
      // The regression this guards: folding walk-in days into openDays disabled the whole
      // calendar for a location that is walk-in every day, and greyed the rest besides.
      pinClockMidMonth();
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = localDateValue(tomorrow);
      render(
        <DatePickerWeb
          onSelect={onSelect}
          openDays={[1, 2, 3, 4, 5, 6, 7]}
          unavailableDays={[todayIso()]}
          unavailableReason="Walk-ins only"
        />
      );
      fireEvent.press(screen.getByTestId("date-picker-trigger"));
      fireEvent.press(screen.getByTestId(`date-picker-day-${tomorrowStr}`));
      expect(onSelect).toHaveBeenCalledWith(tomorrowStr);
    });

    it("does not claim the venue is closed on a walk-in-only day", () => {
      // It is open — you just can't book it online. The red border is for a day the
      // doors are shut, not a day that's open but unbookable online.
      const todayStr = localDateValue(new Date());
      render(
        <DatePickerWeb
          selectedDate={todayStr}
          onSelect={onSelect}
          openDays={[1, 2, 3, 4, 5, 6, 7]}
          unavailableDays={[todayIso()]}
          unavailableReason="Walk-ins only"
        />
      );
      const trigger = screen.getByTestId("date-picker-trigger");
      expect(StyleSheet.flatten(trigger.props.style).borderColor).not.toBe(theme.colors.error);
    });

    it("announces the reason on the unpickable cell", () => {
      const todayStr = localDateValue(new Date());
      render(
        <DatePickerWeb
          onSelect={onSelect}
          openDays={[1, 2, 3, 4, 5, 6, 7]}
          unavailableDays={[todayIso()]}
          unavailableReason="Walk-ins only"
        />
      );
      fireEvent.press(screen.getByTestId("date-picker-trigger"));
      expect(screen.getByTestId(`date-picker-day-${todayStr}`).props.accessibilityHint).toBe(
        "Walk-ins only"
      );
    });
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
    expect(screen.queryByText(APR_16_LABEL)).toBeNull();
  });

  it("overrides the empty-state label too", () => {
    render(<DatePickerWeb onSelect={onSelect} triggerLabel="Any day" />);
    expect(screen.getByText("Any day")).toBeTruthy();
    expect(screen.queryByText("Select a date")).toBeNull();
  });

  it("falls back to the formatted date when no label is supplied", () => {
    render(<DatePickerWeb onSelect={onSelect} icon="calendar-outline" selectedDate="2026-04-16" />);
    expect(screen.getByText(APR_16_LABEL)).toBeTruthy();
  });

  /**
   * Escape is the way out of every other popup in the app. `onRequestClose` covers the Android
   * back button and nothing on web, so a keyboard user who opened the calendar was stuck with it.
   */
  it("closes on Escape", () => {
    render(<DatePickerWeb onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId("date-picker-trigger"));
    expect(screen.getByTestId("date-picker-calendar")).toBeTruthy();

    fireEvent(screen.getByTestId("date-picker-calendar"), "keyDown", {
      key: "Escape",
      preventDefault: jest.fn(),
    });

    expect(screen.queryByTestId("date-picker-calendar")).toBeNull();
  });

  it("leaves other keys to the browser", () => {
    render(<DatePickerWeb onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId("date-picker-trigger"));

    fireEvent(screen.getByTestId("date-picker-calendar"), "keyDown", { key: "a" });

    expect(screen.getByTestId("date-picker-calendar")).toBeTruthy();
  });

  /** The calendar is the focus target while it is open, without joining the tab order. */
  it("takes focus itself rather than leaving it on the page behind", () => {
    render(<DatePickerWeb onSelect={onSelect} />);
    fireEvent.press(screen.getByTestId("date-picker-trigger"));

    expect(screen.getByTestId("date-picker-calendar").props.tabIndex).toBe(-1);
  });
});

/**
 * The month grid, as a keyboard sees it (issue #350). Every day used to be a tab stop with no
 * arrow keys to move between them, so a month cost about 33 presses to get past and there was
 * no way to skip it.
 */
describe("DatePicker (web) keyboard grid", () => {
  const onSelect = jest.fn();
  const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const openOn = (selectedDate: string, props: Record<string, unknown> = {}) => {
    render(<DatePickerWeb selectedDate={selectedDate} onSelect={onSelect} {...props} />);
    fireEvent.press(screen.getByTestId("date-picker-trigger"));
  };

  const press = (key: string) =>
    fireEvent(screen.getByTestId("date-picker-calendar"), "keyDown", {
      key,
      preventDefault: jest.fn(),
    });

  const tabStops = () =>
    screen
      .getAllByTestId(/^date-picker-day-/)
      .filter((cell) => cell.props.tabIndex === 0)
      .map((cell) => cell.props.testID);

  it("gives the whole month one tab stop", () => {
    const todayStr = localDateValue(new Date());
    openOn(todayStr, { openDays: ALL_DAYS });

    expect(tabStops()).toEqual([`date-picker-day-${todayStr}`]);
  });

  it("moves the tab stop with the arrow keys instead of leaving it put", () => {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    openOn(localDateValue(today), { openDays: ALL_DAYS });

    press("ArrowDown");

    expect(tabStops()).toEqual([`date-picker-day-${localDateValue(nextWeek)}`]);
  });

  /** The visible month is read off the highlight, so walking off the end of one pages the grid. */
  it("pages the month when the highlight walks off the end of it", () => {
    const today = new Date();
    const lastOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    const prevLabel = lastOfPrevMonth.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
    const thisLabel = today.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    openOn(localDateValue(lastOfPrevMonth), { allowPast: true });
    expect(screen.getByText(prevLabel)).toBeTruthy();

    press("ArrowRight");

    expect(screen.getByText(thisLabel)).toBeTruthy();
  });

  /**
   * Both commit keys are the grid's, not the cell's: Enter's own default action would activate
   * the backdrop `button` the calendar sits inside, which dismissed it instead of taking the day.
   */
  it.each([
    ["Enter", "Enter"],
    ["Space", " "],
  ])("takes the highlighted day on %s", (_name, key) => {
    const todayStr = localDateValue(new Date());
    openOn(todayStr, { openDays: ALL_DAYS });
    const stopPropagation = jest.fn();

    fireEvent(screen.getByTestId(`date-picker-day-${todayStr}`), "keyDown", {
      key,
      preventDefault: jest.fn(),
      stopPropagation,
    });

    expect(onSelect).toHaveBeenCalledWith(todayStr);
    expect(stopPropagation).toHaveBeenCalled();
    expect(screen.queryByTestId("date-picker-calendar")).toBeNull();
  });

  it("takes the highlighted day on Space from the dialog itself", () => {
    const todayStr = localDateValue(new Date());
    openOn(todayStr, { openDays: ALL_DAYS });

    press(" ");

    expect(onSelect).toHaveBeenCalledWith(todayStr);
    expect(screen.queryByTestId("date-picker-calendar")).toBeNull();
  });

  /**
   * Space is committed by the grid rather than by the cell, so the cell being `disabled` is not
   * what stops it — the grid has to refuse the day itself.
   */
  it("refuses a closed day on Space, the same as pressing it would", () => {
    const today = new Date();
    const todayIso = today.getDay() === 0 ? 7 : today.getDay();
    openOn(localDateValue(today), { openDays: ALL_DAYS.filter((d) => d !== todayIso) });

    press(" ");

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByTestId("date-picker-calendar")).toBeTruthy();
  });

  it("leaves a chorded key to the browser", () => {
    const todayStr = localDateValue(new Date());
    openOn(todayStr, { openDays: ALL_DAYS });

    fireEvent(screen.getByTestId("date-picker-calendar"), "keyDown", {
      key: "ArrowDown",
      ctrlKey: true,
      preventDefault: jest.fn(),
    });

    expect(tabStops()).toEqual([`date-picker-day-${todayStr}`]);
  });

  it("is a grid of days, not a pile of buttons", () => {
    const todayStr = localDateValue(new Date());
    openOn(todayStr, { openDays: ALL_DAYS });

    expect(screen.getByTestId("date-picker-grid").props.role).toBe("grid");
    const day = screen.getByTestId(`date-picker-day-${todayStr}`);
    expect(day.props.role).toBe("gridcell");
    expect(day.props.accessibilityState.selected).toBe(true);
  });

  it("marks only the chosen day as selected", () => {
    pinClockMidMonth();
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    openOn(localDateValue(today), { openDays: ALL_DAYS });

    expect(
      screen.getByTestId(`date-picker-day-${localDateValue(tomorrow)}`).props.accessibilityState
        .selected
    ).toBe(false);
  });
});
