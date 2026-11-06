/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { DateExceptionsSection } from "@/components/admin/settings/DateExceptionsSection";
import type { DateExceptionDto } from "@/api/restaurants";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/context/BrandContext", () => {
  const brand = { primaryColor: "#0a7ea4", appName: "Open Resto" };
  return { useBrand: () => brand };
});

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
}));

jest.mock("@/hooks/use-persisted-state", () => ({
  usePersistedState: (_key: string, defaultValue: unknown) => {
    const { useState } = require("react");
    return useState(defaultValue);
  },
}));

// The pickers are stand-ins that hand back one value each: what the section does with a pick
// is the subject, not the controls themselves, which have their own tests.
jest.mock("@/components/common/DatePicker", () => {
  const { View, Text, Pressable } = require("react-native");
  return {
    __esModule: true,
    default: ({
      selectedDate,
      onSelect,
      maxDaysAhead,
    }: {
      selectedDate?: string;
      onSelect: (d: string) => void;
      maxDaysAhead?: number;
    }) => (
      <View>
        <Text testID="date-picker-value">{selectedDate ?? "none"}</Text>
        <Text testID="date-picker-window">{String(maxDaysAhead)}</Text>
        <Pressable onPress={() => onSelect("2026-12-25")}>
          <Text>Pick Christmas</Text>
        </Pressable>
        <Pressable onPress={() => onSelect("2026-12-31")}>
          <Text>Pick New Year's Eve</Text>
        </Pressable>
      </View>
    ),
  };
});

jest.mock("@/components/common/TimePicker", () => {
  const { View, Text, Pressable } = require("react-native");
  return {
    __esModule: true,
    default: ({
      selectedTime,
      onSelect,
    }: {
      selectedTime: string;
      onSelect: (t: string) => void;
    }) => (
      <View>
        <Text testID="time-picker">{selectedTime}</Text>
        <Pressable onPress={() => onSelect("18:00")}>
          <Text>Pick Time</Text>
        </Pressable>
      </View>
    ),
  };
});

jest.mock("@/components/admin/settings/LastBookingPicker", () => {
  const { View, Text, Pressable } = require("react-native");
  return {
    LastBookingPicker: ({
      value,
      onChange,
    }: {
      value: string | null;
      onChange: (t: string | null) => void;
    }) => (
      <View>
        <Text testID="last-booking-picker">{value ?? "until-close"}</Text>
        <Pressable onPress={() => onChange("23:00")}>
          <Text>Pick Last</Text>
        </Pressable>
      </View>
    ),
  };
});

const theme = {
  borderColor: "#eee",
  mutedColor: "#888",
  primaryColor: "#0a7ea4",
  cardBg: "#fff",
  textColor: "#111",
  isDark: false,
};

const hoursForDay = () => ({ open: "11:00", close: "23:00" });

function renderSection(dateExceptions: DateExceptionDto[], today = "2026-11-06") {
  const onAdd = jest.fn();
  const onRemove = jest.fn();
  render(
    <DateExceptionsSection
      dateExceptions={dateExceptions}
      today={today}
      hoursForDay={hoursForDay}
      onAdd={onAdd}
      onRemove={onRemove}
      {...theme}
    />
  );
  return { onAdd, onRemove };
}

describe("DateExceptionsSection", () => {
  it("collapses to one Add date button when there is nothing listed", () => {
    renderSection([]);
    expect(screen.getByText("Every date follows the weekly hours")).toBeTruthy();
    expect(screen.getByText("Add date")).toBeTruthy();
    expect(screen.queryByTestId("date-exceptions-list")).toBeNull();
  });

  it("lists upcoming dates with what happens on them, and not dates already past", () => {
    renderSection([
      { date: "2026-11-05", type: "closed" },
      { date: "2026-12-25", type: "closed" },
      {
        date: "2026-12-31",
        type: "specialHours",
        open: "18:00",
        close: "01:00",
        lastBooking: "23:00",
      },
      { date: "2026-12-24", type: "walkInOnly" },
    ]);

    expect(screen.getByText("3 upcoming dates differ from the weekly hours")).toBeTruthy();
    expect(screen.queryByTestId("date-exception-2026-11-05")).toBeNull();
    expect(screen.getByText("Closed")).toBeTruthy();
    expect(screen.getByText("Walk-ins only")).toBeTruthy();
    expect(screen.getByText("18:00 – 01:00 · last booking 23:00")).toBeTruthy();
  });

  it("removes a date through its row button", () => {
    const { onRemove } = renderSection([{ date: "2026-12-25", type: "closed" }]);

    fireEvent.press(screen.getByTestId("remove-date-exception-2026-12-25"));

    expect(onRemove).toHaveBeenCalledWith("2026-12-25");
  });

  it("adds a closed date without any hours, through a picker reaching a year ahead", () => {
    const { onAdd } = renderSection([]);

    fireEvent.press(screen.getByText("Add date"));
    expect(screen.getByTestId("date-picker-window").props.children).toBe("365");
    fireEvent.press(screen.getByText("Pick Christmas"));
    fireEvent.press(screen.getByText("Add"));

    expect(onAdd).toHaveBeenCalledWith({ date: "2026-12-25", type: "closed" });
    expect(screen.queryByTestId("date-exception-form")).toBeNull();
  });

  it("adds special hours starting from the weekday's own hours, with their own last booking", () => {
    const { onAdd } = renderSection([]);

    fireEvent.press(screen.getByText("Add date"));
    fireEvent.press(screen.getByText("Pick New Year's Eve"));
    fireEvent.press(screen.getByTestId("date-exception-type-special-hours"));
    // Both time pickers opened on the weekday's hours.
    expect(screen.getAllByTestId("time-picker").map((n) => n.props.children)).toEqual([
      "11:00",
      "23:00",
    ]);
    fireEvent.press(screen.getAllByText("Pick Time")[0]);
    fireEvent.press(screen.getByText("Pick Last"));
    fireEvent.press(screen.getByText("Add"));

    expect(onAdd).toHaveBeenCalledWith({
      date: "2026-12-31",
      type: "specialHours",
      open: "18:00",
      close: "23:00",
      lastBooking: "23:00",
    });
  });

  it("adds a walk-in-only date and says that the date is already listed before replacing it", () => {
    const { onAdd } = renderSection([{ date: "2026-12-25", type: "closed" }]);

    fireEvent.press(screen.getByText("Add date"));
    fireEvent.press(screen.getByText("Pick Christmas"));
    expect(screen.getByText(/already listed/)).toBeTruthy();
    fireEvent.press(screen.getByTestId("date-exception-type-walk-in-only"));
    fireEvent.press(screen.getByText("Add"));

    expect(onAdd).toHaveBeenCalledWith({ date: "2026-12-25", type: "walkInOnly" });
  });

  it("withholds Add until a date is picked, and Cancel discards the form", () => {
    const { onAdd } = renderSection([]);

    fireEvent.press(screen.getByText("Add date"));
    fireEvent.press(screen.getByText("Add"));
    expect(onAdd).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText("Cancel"));
    expect(screen.queryByTestId("date-exception-form")).toBeNull();
    expect(screen.getByText("Add date")).toBeTruthy();
  });
});
