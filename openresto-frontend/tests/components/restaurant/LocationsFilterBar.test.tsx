/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen, fireEvent } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import LocationsFilterBar, { formatBarDate } from "@/components/restaurant/LocationsFilterBar";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

// Both pickers open a Modal on press; rendering its children inline lets tests reach
// the options without driving the modal.
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  rn.Modal = ({ children, visible }: any) => (visible ? children : null);
  return rn;
});

const TODAY = "2026-04-16";

const baseProps = {
  seats: 2,
  onSeatsChange: jest.fn(),
  date: TODAY,
  onDateChange: jest.fn(),
  today: TODAY,
  meal: "All" as const,
  onMealChange: jest.fn(),
};

describe("formatBarDate", () => {
  it("marks today explicitly on the wide bar", () => {
    expect(formatBarDate(TODAY, TODAY, false)).toMatch(/^Today, /);
  });

  it("shortens today to just 'Today' on the compact bar", () => {
    expect(formatBarDate(TODAY, TODAY, true)).toBe("Today");
  });

  it("names other dates without the 'Today' prefix", () => {
    expect(formatBarDate("2026-04-17", TODAY, false)).not.toMatch(/Today/);
    expect(formatBarDate("2026-04-17", TODAY, false)).toContain("Fri");
    expect(formatBarDate("2026-04-17", TODAY, true)).toContain("Fri");
  });
});

describe("LocationsFilterBar", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows the current party size, date and meal window", () => {
    renderWithProviders(<LocationsFilterBar {...baseProps} />);
    expect(screen.getByTestId("locations-filter-bar")).toBeTruthy();
    expect(screen.getByText("2 guests")).toBeTruthy();
    expect(screen.getByText("All times")).toBeTruthy();
    expect(screen.getByText(formatBarDate(TODAY, TODAY, false))).toBeTruthy();
  });

  it("reports a new party size upward", () => {
    const onSeatsChange = jest.fn();
    renderWithProviders(<LocationsFilterBar {...baseProps} onSeatsChange={onSeatsChange} />);
    fireEvent.press(screen.getByLabelText(/^Number of guests,/));
    fireEvent.press(screen.getByText("5 guests"));
    expect(onSeatsChange).toHaveBeenCalledWith(5);
  });

  it("reports a new meal window upward", () => {
    const onMealChange = jest.fn();
    renderWithProviders(<LocationsFilterBar {...baseProps} onMealChange={onMealChange} />);
    fireEvent.press(screen.getByLabelText(/^Time of day,/));
    fireEvent.press(screen.getByText("Dinner"));
    expect(onMealChange).toHaveBeenCalledWith("Dinner");
  });

  it("reports a new date upward", () => {
    const onDateChange = jest.fn();
    renderWithProviders(<LocationsFilterBar {...baseProps} onDateChange={onDateChange} />);
    fireEvent.press(screen.getByText(formatBarDate(TODAY, TODAY, false)));
    // Off web the picker is the system calendar (#423), which reports a pick through its own
    // onChange rather than as a pressable row. Driving it that way proves the selection is
    // reported upward rather than kept internally.
    fireEvent(
      screen.getByTestId("date-picker-control"),
      "change",
      { type: "set" },
      new Date(2026, 3, 17)
    );
    expect(onDateChange).toHaveBeenCalledWith("2026-04-17");
  });

  it("renders the availability summary when given one", () => {
    renderWithProviders(
      <LocationsFilterBar {...baseProps} summary="2 of 3 locations have tables" />
    );
    expect(screen.getByText("2 of 3 locations have tables")).toBeTruthy();
  });

  it("lets the summary wrap rather than spill out of the bar", () => {
    renderWithProviders(
      <LocationsFilterBar {...baseProps} summary="2 of 6 locations have tables" />
    );
    // The three controls hold a fixed minimum width, so on a list column narrowed by the
    // booking panel the summary has to be able to drop onto its own line.
    const bar = StyleSheet.flatten(screen.getByTestId("locations-filter-bar").props.style);
    expect(bar.flexWrap).toBe("wrap");
  });

  it("omits the summary when there is nothing to say", () => {
    renderWithProviders(<LocationsFilterBar {...baseProps} summary={null} />);
    expect(screen.queryByText(/locations have tables/)).toBeNull();
  });

  describe("compact bar", () => {
    it("drops the summary and shortens the seat labels to fit a phone", () => {
      renderWithProviders(
        <LocationsFilterBar {...baseProps} compact summary="2 of 3 locations have tables" />
      );
      expect(screen.queryByText("2 of 3 locations have tables")).toBeNull();
      expect(screen.queryByText("2 guests")).toBeNull();
      // The seat trigger is now a bare number, and the date loses its weekday.
      expect(screen.getByText("2")).toBeTruthy();
      expect(screen.getByText("Today")).toBeTruthy();
    });

    it("gives the seat trigger room for its own icon, digits and chevron", () => {
      renderWithProviders(<LocationsFilterBar {...baseProps} compact />);
      // A 1:2:2 share of a 390px phone is 64px, less than the trigger's contents, and the
      // count ellipsised down to a stray dot beside the icon. The floor is what it needs.
      const seats = StyleSheet.flatten(screen.getByTestId("filter-control-seats").props.style);
      expect(seats.minWidth).toBeGreaterThanOrEqual(80);
    });

    it("shortens the meal window to a single word", () => {
      renderWithProviders(<LocationsFilterBar {...baseProps} compact meal="All" />);
      expect(screen.getByText("All")).toBeTruthy();
      expect(screen.queryByText("All times")).toBeNull();
    });

    it("still reports changes upward", () => {
      const onSeatsChange = jest.fn();
      renderWithProviders(
        <LocationsFilterBar {...baseProps} compact onSeatsChange={onSeatsChange} />
      );
      fireEvent.press(screen.getByLabelText(/^Number of guests,/));
      fireEvent.press(screen.getByText("6"));
      expect(onSeatsChange).toHaveBeenCalledWith(6);
    });
  });
});
