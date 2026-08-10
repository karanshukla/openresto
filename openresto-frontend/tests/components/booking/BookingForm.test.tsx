/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import BookingForm from "@/components/booking/BookingForm";
import { getNowInTimezone } from "@/utils/date";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

// This whole file renders under Platform.OS === "web" at a desktop width, so the
// two-column layout branches (fieldRow/fieldHalf/holdPush styles) get exercised.
// The native (non-web) branches are already covered by
// tests/components/BookingForm.test.tsx, which uses the jest-expo default
// (Platform.OS === "ios").
//
// A phone browser is also Platform.OS === "web", so width — not platform — is
// what decides the column count. useWindowDimensions reads Dimensions.get, so
// patching that is how the responsive-layout tests below shrink the viewport.
let mockViewportWidth = 1024;
jest.mock("react-native", () => {
  const rn = jest.requireActual("react-native");
  rn.Platform.OS = "web";
  const actualGet = rn.Dimensions.get.bind(rn.Dimensions);
  rn.Dimensions.get = (dim: string) =>
    dim === "window" ? { ...actualGet("window"), width: mockViewportWidth } : actualGet(dim);
  return rn;
});

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

// Controllable hold status
const mockSetHoldStatus = jest.fn();
const mockReleaseCurrentHold = jest.fn();
let mockHoldStatus = "idle";

jest.mock("@/components/booking/useTableHold", () => ({
  useTableHold: () => ({
    hold: null,
    holdStatus: mockHoldStatus,
    secondsLeft: 0,
    holdId: null,
    resolvedTableId: null,
    resolvedSectionId: null,
    setHoldStatus: mockSetHoldStatus,
    releaseCurrentHold: mockReleaseCurrentHold,
  }),
}));

const mockFetchAvailability = jest.fn();
jest.mock("@/api/availability", () => ({
  fetchAvailability: (...args: unknown[]) => mockFetchAvailability(...args),
}));

jest.mock("@/components/booking/HoldStatusBanner", () => ({
  __esModule: true,
  default: () => {
    const { View } = require("react-native");
    return <View testID="hold-banner" />;
  },
}));

jest.mock("@/components/booking/LargePartyNoticeModal", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/booking/PopularTimesPicker", () => ({
  __esModule: true,
  default: () => {
    const { Text } = require("react-native");
    return <Text>PopularTimesPicker</Text>;
  },
}));

jest.mock("@/components/common/Input", () => ({
  __esModule: true,
  default: ({
    placeholder,
    onChangeText,
  }: {
    placeholder?: string;
    onChangeText?: (v: string) => void;
  }) => {
    const { TextInput } = require("react-native");
    return <TextInput placeholder={placeholder} onChangeText={onChangeText} />;
  },
}));

jest.mock("@/components/common/Button", () => ({
  __esModule: true,
  default: ({ children, onPress, disabled }: any) => {
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable onPress={onPress} disabled={disabled} testID="submit-btn">
        <Text>{children}</Text>
      </Pressable>
    );
  },
}));

// TimePicker mock also surfaces minTime/maxTime so tests can assert the
// after-midnight-closing fallback (maxPickerTime -> "23:45").
jest.mock("@/components/common/TimePicker", () => ({
  __esModule: true,
  default: ({
    selectedTime,
    minTime,
    maxTime,
  }: {
    selectedTime: string;
    minTime?: string;
    maxTime?: string;
  }) => {
    const { Text } = require("react-native");
    return (
      <Text testID="time-picker">
        {selectedTime}|{minTime}|{maxTime}
      </Text>
    );
  },
}));

// DatePicker mock that lets tests trigger a date selection: a closed Saturday,
// a Sunday (to exercise the jsDay===0 -> isoDay 7 mapping), and clearing the
// date entirely (to exercise the "no date selected" fallback branches).
jest.mock("@/components/common/DatePicker", () => ({
  __esModule: true,
  default: ({ onSelect }: { onSelect: (date: string) => void }) => {
    const { Pressable, Text, View } = require("react-native");
    return (
      <View>
        <Pressable testID="date-picker-sat" onPress={() => onSelect("2026-06-20")}>
          <Text>Pick Saturday</Text>
        </Pressable>
        <Pressable testID="date-picker-sun" onPress={() => onSelect("2026-06-21")}>
          <Text>Pick Sunday</Text>
        </Pressable>
        <Pressable testID="date-picker-clear" onPress={() => onSelect("")}>
          <Text>Clear date</Text>
        </Pressable>
      </View>
    );
  },
}));

// Select mock: exposes section selector via testID
jest.mock("@/utils/date", () => ({
  getNowInTimezone: jest.fn(() => ({ dateStr: "2026-06-23", hours: 10, minutes: 0 })),
  formatCurrentTimeInTimezone: jest.fn(() => "10:00 AM"),
  isViewerInTimezone: jest.fn(() => false),
}));

jest.mock("@/components/common/Select", () => ({
  __esModule: true,
  default: ({ onSelect, placeholder, selectedValue, options }: any) => {
    const { Pressable, Text } = require("react-native");
    if (placeholder === "Select a section") {
      return (
        <Pressable testID="section-select" onPress={() => onSelect(20)}>
          <Text>SectionSelect:{selectedValue}</Text>
        </Pressable>
      );
    }
    if (placeholder === "Select a table") {
      // Pick whichever option isn't already selected, so pressing always
      // fires a real onSelect(<different id>) call.
      const alt =
        options?.find((o: { value: number }) => o.value !== selectedValue) ?? options?.[0];
      return (
        <Pressable testID="table-select" onPress={() => onSelect(alt?.value)}>
          <Text>TableSelect:{selectedValue}</Text>
        </Pressable>
      );
    }
    return <Text testID="select-other">{String(selectedValue ?? placeholder ?? "Select")}</Text>;
  },
}));

const mockRestaurantWeekdays = {
  id: 1,
  name: "Bistro",
  address: "1 Main St",
  openTime: "11:00",
  closeTime: "22:00",
  openDays: "1,2,3,4,5", // Mon–Fri only
  timezone: "UTC",
  sections: [
    {
      id: 10,
      name: "Main",
      restaurantId: 1,
      tables: [{ id: 100, name: "T1", seats: 4, sectionId: 10 }],
    },
    {
      id: 20,
      name: "Patio",
      restaurantId: 1,
      tables: [{ id: 200, name: "T2", seats: 2, sectionId: 20 }],
    },
  ],
};

const mockRestaurantAllDays = {
  ...mockRestaurantWeekdays,
  openDays: "1,2,3,4,5,6,7",
};

// No `openDays` at all -> exercises the "default to every day" fallback.
// (openDays is required on RestaurantDto; cast to model a real-world/older
// payload that omits it, which is exactly what the `restaurant.openDays?.`
// optional chaining in the component defends against.)
const mockRestaurantNoOpenDays = (() => {
  const { openDays: _openDays, ...rest } = mockRestaurantAllDays;
  return rest as unknown as typeof mockRestaurantAllDays;
})();

// No sections -> exercises the sectionId/tablesInSection/timezone fallbacks.
// timezone: "" (rather than omitted) keeps this assignable to RestaurantDto
// while still being falsy, which is what triggers the `|| "UTC"` fallback.
const mockRestaurantEmptySections = {
  id: 2,
  name: "Empty Spot",
  address: "2 Side St",
  openTime: "11:00",
  closeTime: "22:00",
  openDays: "1,2,3,4,5,6,7",
  timezone: "",
  sections: [],
};

// Closing time wraps past midnight -> exercises the "23:45" max-picker-time
// fallback (close <= open).
const mockRestaurantLateNight = {
  ...mockRestaurantAllDays,
  openTime: "18:00",
  closeTime: "02:00",
};

// Open all hours so the mocked "now" (10:00) always falls inside the open
// window -> exercises suggestTime's minute-bucket branches directly, rather
// than its (already istanbul-ignored) "outside open hours" early return.
const mockRestaurantWideOpen = {
  ...mockRestaurantAllDays,
  openTime: "00:00",
  closeTime: "23:59",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockHoldStatus = "idle";
  // Both tables (T1=100 in Main, T2=200 in Patio) are available so switching sections
  // in either direction still surfaces a table dropdown.
  mockFetchAvailability.mockResolvedValue({
    slots: [
      { time: "19:00", isAvailable: true, availableTableIds: [100, 200], category: "Dinner" },
    ],
  });
  // jest.clearAllMocks() clears call history but not a mockReturnValue set by
  // an earlier test — restore the module's default "now" here so tests don't
  // leak their overrides into one another.
  (getNowInTimezone as jest.Mock).mockReturnValue({ dateStr: "2026-06-23", hours: 10, minutes: 0 });
});

describe("BookingForm", () => {
  it("renders the form with Popular Times label", () => {
    render(<BookingForm restaurant={mockRestaurantAllDays} onSubmit={jest.fn()} />);
    expect(screen.getByText("Popular Times")).toBeTruthy();
  });

  it("shows 'closed on this day' when a closed day is selected", async () => {
    render(<BookingForm restaurant={mockRestaurantWeekdays} onSubmit={jest.fn()} />);
    // Wait for the initial availability fetch (today's date, which is open)
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalledTimes(1));
    // Clear so we can assert no extra call for the closed day
    mockFetchAvailability.mockClear();

    // "2026-06-20" is a Saturday — not in openDays "1,2,3,4,5"
    await act(async () => {
      fireEvent.press(screen.getByTestId("date-picker-sat"));
    });
    await waitFor(() => {
      expect(
        screen.getByText("The restaurant is closed on this day. Please select a different date.")
      ).toBeTruthy();
    });
    // fetchAvailability should NOT be called for a closed day
    expect(mockFetchAvailability).not.toHaveBeenCalled();
  });

  it("resets hold status to idle when section is changed while held", async () => {
    mockHoldStatus = "held";
    render(<BookingForm restaurant={mockRestaurantAllDays} onSubmit={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId("section-select")).toBeTruthy());
    fireEvent.press(screen.getByTestId("section-select"));
    expect(mockSetHoldStatus).toHaveBeenCalledWith("idle");
  });

  it("resets hold status to idle when section is changed while expired", async () => {
    mockHoldStatus = "expired";
    render(<BookingForm restaurant={mockRestaurantAllDays} onSubmit={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId("section-select")).toBeTruthy());
    fireEvent.press(screen.getByTestId("section-select"));
    expect(mockSetHoldStatus).toHaveBeenCalledWith("idle");
  });

  it("does not reset hold status when section is changed while idle", async () => {
    mockHoldStatus = "idle";
    render(<BookingForm restaurant={mockRestaurantAllDays} onSubmit={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId("section-select")).toBeTruthy());
    fireEvent.press(screen.getByTestId("section-select"));
    expect(mockSetHoldStatus).not.toHaveBeenCalled();
  });

  it("shows the walk-in notice and skips fetch when a walk-in-only day is selected", async () => {
    // Saturdays (ISO 6) are walk-in only; the restaurant is open every day.
    const restaurant = { ...mockRestaurantAllDays, walkInDays: "6" };
    render(<BookingForm restaurant={restaurant} onSubmit={jest.fn()} />);
    // Initial fetch happens for today's (bookable) date
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalledTimes(1));
    mockFetchAvailability.mockClear();

    // "2026-06-20" is a Saturday
    await act(async () => {
      fireEvent.press(screen.getByTestId("date-picker-sat"));
    });
    await waitFor(() => {
      expect(screen.getByTestId("walk-in-notice")).toBeTruthy();
    });
    expect(screen.getByText("Walk-ins only on this day")).toBeTruthy();
    expect(screen.getByText(/doesn't take online bookings on Saturdays/)).toBeTruthy();
    expect(mockFetchAvailability).not.toHaveBeenCalled();
  });

  it("shows a persistent banner naming the walk-in days regardless of the selected date", () => {
    // Today ("2026-06-23", a Tuesday per the mocked clock) is bookable, but
    // Saturdays are walk-in only — the banner should still be visible.
    const restaurant = { ...mockRestaurantAllDays, walkInDays: "6" };
    render(<BookingForm restaurant={restaurant} onSubmit={jest.fn()} />);
    expect(screen.getByTestId("walk-in-days-banner")).toBeTruthy();
    expect(screen.getByText(/Walk-ins only on Saturdays/)).toBeTruthy();
  });

  it("does not show the walk-in days banner when no walk-in days are configured", () => {
    render(<BookingForm restaurant={mockRestaurantAllDays} onSubmit={jest.fn()} />);
    expect(screen.queryByTestId("walk-in-days-banner")).toBeNull();
  });

  it("falls back to a WalkInNotice with no days label when walk-in-only is set globally (no walkInDays)", async () => {
    const restaurant = { ...mockRestaurantAllDays, walkInOnly: true };
    render(<BookingForm restaurant={restaurant} onSubmit={jest.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId("walk-in-notice")).toBeTruthy();
    });
  });

  it("renders the 'Any section' auto-assign hint and omits the timezone hint for a restaurant with no sections and no timezone", () => {
    // With no sections to switch to, the form stays in "Any section" mode and shows the
    // auto-assign hint instead of the legacy "No tables available" explicit-table message.
    render(<BookingForm restaurant={mockRestaurantEmptySections} onSubmit={jest.fn()} />);
    expect(screen.getByText(/We'll seat you at the best available table/)).toBeTruthy();
    expect(screen.queryByText(/All times are in/)).toBeNull();
  });

  it("defaults to a 7-day open list when restaurant.openDays is not provided", () => {
    render(<BookingForm restaurant={mockRestaurantNoOpenDays} onSubmit={jest.fn()} />);
    // Today ("2026-06-23") should be treated as open, so PopularTimesPicker
    // renders instead of the closed-day notice.
    expect(screen.getByText("PopularTimesPicker")).toBeTruthy();
    expect(
      screen.queryByText("The restaurant is closed on this day. Please select a different date.")
    ).toBeNull();
  });

  it("maps a Sunday selection to ISO day 7 and flags it closed for a weekdays-only restaurant", async () => {
    render(<BookingForm restaurant={mockRestaurantWeekdays} onSubmit={jest.fn()} />);
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalledTimes(1));
    mockFetchAvailability.mockClear();

    // "2026-06-21" is a Sunday — not in openDays "1,2,3,4,5"
    await act(async () => {
      fireEvent.press(screen.getByTestId("date-picker-sun"));
    });
    await waitFor(() => {
      expect(
        screen.getByText("The restaurant is closed on this day. Please select a different date.")
      ).toBeTruthy();
    });
    expect(mockFetchAvailability).not.toHaveBeenCalled();
  });

  it("treats a cleared date as open with no selected day", async () => {
    render(<BookingForm restaurant={mockRestaurantWeekdays} onSubmit={jest.fn()} />);
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalledTimes(1));
    mockFetchAvailability.mockClear();

    await act(async () => {
      fireEvent.press(screen.getByTestId("date-picker-clear"));
    });
    // With no date selected, isClosedDay/isWalkInDay are both forced false,
    // so PopularTimesPicker renders rather than a closed/walk-in notice.
    await waitFor(() => {
      expect(screen.getByText("PopularTimesPicker")).toBeTruthy();
    });
    expect(
      screen.queryByText("The restaurant is closed on this day. Please select a different date.")
    ).toBeNull();
  });

  it("rolls suggestDate over to the next day once the current time is past the last bookable window", async () => {
    // Restaurant closes at 12:00, so the latest bookable start is 10:45.
    // Mocked "now" of 23:00 is well past that, forcing the addDays fallback.
    const restaurant = { ...mockRestaurantAllDays, openTime: "08:00", closeTime: "12:00" };
    (getNowInTimezone as jest.Mock).mockReturnValue({
      dateStr: "2026-06-23",
      hours: 23,
      minutes: 0,
    });
    render(<BookingForm restaurant={restaurant} onSubmit={jest.fn()} initialTime="10:00" />);
    await waitFor(() => {
      expect(mockFetchAvailability).toHaveBeenCalledWith(restaurant.id, "2026-06-24", 2);
    });
  });

  it.each([
    [5, "10:15"], // minutes < 15
    [20, "10:30"], // 15 <= minutes < 30
    [35, "10:45"], // 30 <= minutes < 45
    [50, "11:00"], // minutes >= 45 -> rolls to the next hour
  ])("suggests %i minutes past the hour as %s", async (minutes, expected) => {
    (getNowInTimezone as jest.Mock).mockReturnValue({
      dateStr: "2026-06-23",
      hours: 10,
      minutes,
    });
    render(<BookingForm restaurant={mockRestaurantWideOpen} onSubmit={jest.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId("time-picker").props.children[0]).toBe(expected);
    });
  });

  it("does not auto-select a time when no slots are available at all", async () => {
    mockFetchAvailability.mockResolvedValue({
      slots: [{ time: "12:00", isAvailable: false, availableTableIds: [], category: "Lunch" }],
    });
    render(<BookingForm restaurant={mockRestaurantWideOpen} onSubmit={jest.fn()} />);
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalled());
    // suggestTime(10:00) -> "10:15"; since no slot is available, time is left alone.
    expect(screen.getByTestId("time-picker").props.children[0]).toBe("10:15");
  });

  it("falls back to 23:45 as the max picker time when closing wraps past midnight", () => {
    render(<BookingForm restaurant={mockRestaurantLateNight} onSubmit={jest.fn()} />);
    const text = screen.getByTestId("time-picker").props.children.join("");
    expect(text).toContain("|23:45");
  });

  it("resets hold status to idle when the table is changed while held", async () => {
    mockHoldStatus = "held";
    render(<BookingForm restaurant={mockRestaurantAllDays} onSubmit={jest.fn()} />);
    // The form defaults to "Any section" (table dropdown hidden); switch to a concrete
    // section to expose the table dropdown.
    await act(async () => {
      fireEvent.press(screen.getByTestId("section-select"));
    });
    await waitFor(() => expect(screen.getByTestId("table-select")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId("table-select"));
    });
    expect(mockSetHoldStatus).toHaveBeenCalledWith("idle");
  });

  it("resets hold status to idle when the table is changed while expired", async () => {
    mockHoldStatus = "expired";
    render(<BookingForm restaurant={mockRestaurantAllDays} onSubmit={jest.fn()} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId("section-select"));
    });
    await waitFor(() => expect(screen.getByTestId("table-select")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId("table-select"));
    });
    expect(mockSetHoldStatus).toHaveBeenCalledWith("idle");
  });

  it("does not reset hold status when the table is changed while idle", async () => {
    mockHoldStatus = "idle";
    render(<BookingForm restaurant={mockRestaurantAllDays} onSubmit={jest.fn()} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId("section-select"));
    });
    await waitFor(() => expect(screen.getByTestId("table-select")).toBeTruthy());
    await act(async () => {
      fireEvent.press(screen.getByTestId("table-select"));
    });
    expect(mockSetHoldStatus).not.toHaveBeenCalled();
  });

  // ── "Any section" auto-assign ──────────────────────────────────────────────

  it("defaults to 'Any section' and shows the auto-assign hint instead of the table dropdown", () => {
    render(<BookingForm restaurant={mockRestaurantAllDays} onSubmit={jest.fn()} />);
    // The auto-assign hint replaces the table dropdown.
    expect(screen.getByText(/We'll seat you at the best available table/)).toBeTruthy();
    expect(screen.queryByTestId("table-select")).toBeNull();
  });

  it("reveals the table dropdown when a concrete section is selected", async () => {
    render(<BookingForm restaurant={mockRestaurantAllDays} onSubmit={jest.fn()} />);
    expect(screen.queryByTestId("table-select")).toBeNull();
    // section-select mock fires onSelect(20) -> Patio section.
    await act(async () => {
      fireEvent.press(screen.getByTestId("section-select"));
    });
    await waitFor(() => expect(screen.getByTestId("table-select")).toBeTruthy());
    // Switching out of "Any section" hides the auto-assign hint.
    expect(screen.queryByText(/We'll seat you at the best available table/)).toBeNull();
  });

  it("submits with null tableId/sectionId when 'Any section' is active", async () => {
    mockHoldStatus = "held";
    const onSubmit = jest.fn();
    render(<BookingForm restaurant={mockRestaurantAllDays} onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByPlaceholderText("Your full name"), "Auto User");
    fireEvent.changeText(screen.getByPlaceholderText("your@email.com"), "auto@test.com");
    await act(async () => {
      fireEvent.press(screen.getByText("Confirm Booking"));
    });
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ tableId: null, sectionId: null })
    );
  });

  // ── Max table oversize (#244) ──────────────────────────────────────────────
  // The section-select mock fires onSelect(20) -> Patio, so this variant puts an
  // oversized table in Patio to exercise the frontend oversize filter. With a 2-top
  // party (the default) and a cap of 1 spare seat, a 6-seat table is excluded and the
  // section shows "No tables available" instead of the dropdown.
  const mockRestaurantOversizedPatio = {
    ...mockRestaurantAllDays,
    maxTableOversizeSeats: 1,
    sections: [
      {
        id: 10,
        name: "Main",
        restaurantId: 1,
        tables: [{ id: 100, name: "T1", seats: 2, sectionId: 10 }],
      },
      {
        id: 20,
        name: "Patio",
        restaurantId: 1,
        tables: [{ id: 200, name: "Big", seats: 6, sectionId: 20 }],
      },
    ],
  };

  it("hides oversized tables from the dropdown when maxTableOversizeSeats is set", async () => {
    render(<BookingForm restaurant={mockRestaurantOversizedPatio} onSubmit={jest.fn()} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId("section-select")); // -> Patio (6-seat table)
    });
    // 6 seats - 2 guests = 4 spare > cap of 1 -> excluded -> no eligible tables.
    expect(screen.getByText(/No tables available for 2 guests/)).toBeTruthy();
    expect(screen.queryByTestId("table-select")).toBeNull();
  });

  it("still offers the oversized table when maxTableOversizeSeats is unset", async () => {
    const unrestricted = { ...mockRestaurantOversizedPatio, maxTableOversizeSeats: undefined };
    render(<BookingForm restaurant={unrestricted} onSubmit={jest.fn()} />);
    await act(async () => {
      fireEvent.press(screen.getByTestId("section-select")); // -> Patio (6-seat table)
    });
    // No cap -> the 6-seat table is eligible and the dropdown renders.
    await waitFor(() => expect(screen.getByTestId("table-select")).toBeTruthy());
    expect(screen.queryByText(/No tables available/)).toBeNull();
  });

  // ── Combinable table groups (#274) ────────────────────────────────────────
  //
  // A restaurant whose largest single table is 4 seats but which has a combinable group of 8.
  // A party of 6 is seatable only via the group — the large-party modal must NOT fire.

  const mockRestaurantWithGroup = {
    ...mockRestaurantAllDays,
    sections: [
      {
        id: 10,
        name: "Main",
        restaurantId: 1,
        tables: [
          { id: 100, name: "T1", seats: 4, sectionId: 10 },
          { id: 101, name: "T2", seats: 4, sectionId: 10 },
        ],
      },
    ],
    groups: [
      {
        id: 1,
        name: null,
        combinedSeats: 8,
        members: [
          { id: 100, name: "T1", seats: 4 },
          { id: 101, name: "T2", seats: 4 },
        ],
      },
    ],
  };

  it("does not show the large-party notice when a combinable group can seat the party", async () => {
    // Party of 6 exceeds the largest single table (4) but fits the group (8).
    render(
      <BookingForm restaurant={mockRestaurantWithGroup} onSubmit={jest.fn()} initialSeats={6} />
    );
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalled());
    // No large-party notice/modal since the group can seat the party.
    expect(screen.queryByText("Large party")).toBeNull();
  });

  it("still shows the large-party notice when even the group cannot seat the party", async () => {
    // Party of 10 exceeds both the largest single table (4) and the group (8).
    render(
      <BookingForm restaurant={mockRestaurantWithGroup} onSubmit={jest.fn()} initialSeats={10} />
    );
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalled());
    // The large-party notice (and auto-opened modal) both render — assert at least one.
    expect(screen.getAllByText("Large party").length).toBeGreaterThan(0);
  });

  it("offers the group as a dropdown option when availableGroupIds includes it", async () => {
    mockFetchAvailability.mockResolvedValue({
      slots: [
        {
          time: "19:00",
          isAvailable: true,
          availableTableIds: [],
          availableGroupIds: [1],
          category: "Dinner",
        },
      ],
    });
    render(
      <BookingForm restaurant={mockRestaurantWithGroup} onSubmit={jest.fn()} initialSeats={6} />
    );
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalled());
    // Switch out of "Any section" so the explicit table dropdown is visible.
    await act(async () => {
      fireEvent.press(screen.getByTestId("section-select"));
    });
    // The dropdown renders (a group is selectable) even though no single table is available.
    await waitFor(() => expect(screen.getByTestId("table-select")).toBeTruthy());
    expect(screen.queryByText(/No tables available/)).toBeNull();
  });

  it("does not offer the group when availableGroupIds excludes it", async () => {
    mockFetchAvailability.mockResolvedValue({
      slots: [
        {
          time: "19:00",
          isAvailable: true,
          availableTableIds: [],
          availableGroupIds: [], // group not bookable for this slot
          category: "Dinner",
        },
      ],
    });
    render(
      <BookingForm restaurant={mockRestaurantWithGroup} onSubmit={jest.fn()} initialSeats={6} />
    );
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalled());
    // Switch out of "Any section" so the explicit table dropdown would be visible if eligible.
    await act(async () => {
      fireEvent.press(screen.getByTestId("section-select"));
    });
    // No standalone tables (empty availableTableIds) and the group excluded → no dropdown.
    expect(screen.getByText(/No tables available for 6 guests/)).toBeTruthy();
  });

  // ── Groups are scoped to the picked section ───────────────────────────────
  //
  // The Select mock always resolves the section field to id 20 ("Patio"), so these two fixtures
  // differ only in which section owns the group's member tables.

  const groupOfEights = [
    {
      id: 1,
      name: null,
      combinedSeats: 8,
      members: [
        { id: 100, name: "T1", seats: 4 },
        { id: 101, name: "T2", seats: 4 },
      ],
    },
  ];

  const mockRestaurantGroupInMain = {
    ...mockRestaurantAllDays,
    sections: [
      {
        id: 10,
        name: "Main",
        restaurantId: 1,
        tables: [
          { id: 100, name: "T1", seats: 4, sectionId: 10 },
          { id: 101, name: "T2", seats: 4, sectionId: 10 },
        ],
      },
      {
        id: 20,
        name: "Patio",
        restaurantId: 1,
        tables: [{ id: 200, name: "P1", seats: 2, sectionId: 20 }],
      },
    ],
    groups: groupOfEights,
  };

  const mockRestaurantGroupInPatio = {
    ...mockRestaurantAllDays,
    sections: [
      {
        id: 10,
        name: "Main",
        restaurantId: 1,
        tables: [{ id: 200, name: "P1", seats: 2, sectionId: 10 }],
      },
      {
        id: 20,
        name: "Patio",
        restaurantId: 1,
        tables: [
          { id: 100, name: "T1", seats: 4, sectionId: 20 },
          { id: 101, name: "T2", seats: 4, sectionId: 20 },
        ],
      },
    ],
    groups: groupOfEights,
  };

  const groupOnlySlot = {
    slots: [
      {
        time: "19:00",
        isAvailable: true,
        availableTableIds: [],
        availableGroupIds: [1],
        category: "Dinner",
      },
    ],
  };

  it("does not offer a group whose tables live in another section", async () => {
    mockFetchAvailability.mockResolvedValue(groupOnlySlot);
    render(
      <BookingForm restaurant={mockRestaurantGroupInMain} onSubmit={jest.fn()} initialSeats={6} />
    );
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalled());
    // Select "Patio" — the group's tables are both in "Main".
    await act(async () => {
      fireEvent.press(screen.getByTestId("section-select"));
    });
    expect(screen.getByText(/No tables available for 6 guests/)).toBeTruthy();
  });

  it("offers a group whose tables all live in the picked section", async () => {
    mockFetchAvailability.mockResolvedValue(groupOnlySlot);
    render(
      <BookingForm restaurant={mockRestaurantGroupInPatio} onSubmit={jest.fn()} initialSeats={6} />
    );
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalled());
    // Select "Patio" — this time it owns both of the group's tables.
    await act(async () => {
      fireEvent.press(screen.getByTestId("section-select"));
    });
    await waitFor(() => expect(screen.getByTestId("table-select")).toBeTruthy());
    expect(screen.queryByText(/No tables available/)).toBeNull();
  });

  it("still offers every group under 'Any section'", async () => {
    mockFetchAvailability.mockResolvedValue(groupOnlySlot);
    render(
      <BookingForm restaurant={mockRestaurantGroupInMain} onSubmit={jest.fn()} initialSeats={6} />
    );
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalled());
    // Auto-assign is the default; the group still counts toward capacity, so no large-party notice.
    expect(screen.queryByText("Large party")).toBeNull();
    expect(screen.getByText(/best available table/)).toBeTruthy();
  });
});

// Platform.OS === "web" covers a phone browser too, so these assert that the
// side-by-side field pairs collapse on width rather than on platform.
describe("BookingForm responsive layout", () => {
  const DESKTOP_WIDTH = 1024;
  const PHONE_WIDTH = 390;

  afterEach(() => {
    mockViewportWidth = DESKTOP_WIDTH;
  });

  function rowFlexDirections() {
    return screen
      .getAllByTestId("booking-field-row")
      .map((row) => StyleSheet.flatten(row.props.style)?.flexDirection);
  }

  it("lays the field pairs out side by side at desktop width", async () => {
    mockViewportWidth = DESKTOP_WIDTH;
    render(<BookingForm restaurant={mockRestaurantAllDays} onSubmit={jest.fn()} />);
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalled());

    const directions = rowFlexDirections();
    expect(directions).toHaveLength(4);
    expect(directions.every((d) => d === "row")).toBe(true);
  });

  it("stacks every field pair onto its own row at phone width", async () => {
    mockViewportWidth = PHONE_WIDTH;
    render(<BookingForm restaurant={mockRestaurantAllDays} onSubmit={jest.fn()} />);
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalled());

    const directions = rowFlexDirections();
    expect(directions).toHaveLength(4);
    // No row lays out horizontally, so Email and Special Requests each get the
    // full width instead of sharing a ~180px column.
    expect(directions.every((d) => d === undefined)).toBe(true);
  });

  it("renders the hold banner exactly once in either layout", async () => {
    mockViewportWidth = PHONE_WIDTH;
    const { unmount } = render(
      <BookingForm restaurant={mockRestaurantAllDays} onSubmit={jest.fn()} />
    );
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalled());
    expect(screen.getAllByTestId("hold-banner")).toHaveLength(1);
    unmount();

    mockViewportWidth = DESKTOP_WIDTH;
    render(<BookingForm restaurant={mockRestaurantAllDays} onSubmit={jest.fn()} />);
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalled());
    expect(screen.getAllByTestId("hold-banner")).toHaveLength(1);
  });
});

// The drawer variant of the form: party size and date have already been settled by the
// page-level filter bar, so those pickers are gone and seating moves behind a disclosure.
describe("BookingForm drawer layout", () => {
  beforeEach(() => {
    mockViewportWidth = 1024;
    mockHoldStatus = "idle";
    mockFetchAvailability.mockResolvedValue({ slots: [] });
  });

  function renderDrawer(overrides: Record<string, unknown> = {}) {
    return render(
      <BookingForm
        layout="drawer"
        restaurant={mockRestaurantAllDays}
        seats={4}
        date="2026-06-24"
        onSubmit={jest.fn()}
        {...overrides}
      />
    );
  }

  it("drops the guests and date pickers — the page bar owns them", async () => {
    renderDrawer();
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalled());
    expect(screen.queryByText("Number of Guests")).toBeNull();
    expect(screen.queryByText("Date")).toBeNull();
    expect(screen.queryAllByTestId("booking-field-row")).toHaveLength(0);
  });

  it("fetches availability for the caller's party size and date", async () => {
    renderDrawer();
    await waitFor(() =>
      expect(mockFetchAvailability).toHaveBeenCalledWith(expect.anything(), "2026-06-24", 4)
    );
  });

  it("asks only for name, email and requests up front", async () => {
    renderDrawer();
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalled());
    expect(screen.getByPlaceholderText("Your full name")).toBeTruthy();
    expect(screen.getByPlaceholderText("your@email.com")).toBeTruthy();
    expect(screen.getByText("Special requests / allergies")).toBeTruthy();
    // Section and table stay behind the disclosure until asked for.
    expect(screen.queryByText("Section")).toBeNull();
    expect(screen.queryByText("Table")).toBeNull();
  });

  it("reveals the time, section and table controls from the seating disclosure", async () => {
    renderDrawer();
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalled());

    fireEvent.press(screen.getByTestId("seating-disclosure-toggle"));
    expect(screen.getByText("Section")).toBeTruthy();
    expect(screen.getByText("Table")).toBeTruthy();
    expect(screen.getByTestId("time-picker")).toBeTruthy();

    fireEvent.press(screen.getByTestId("seating-disclosure-toggle"));
    expect(screen.queryByText("Section")).toBeNull();
    // The toggle keeps one stable label and flips its chevron, rather than renaming
    // itself — the row is a section boundary, not a link that changes meaning.
    expect(screen.getByText("Choose a section or table")).toBeTruthy();
  });

  it("groups the drawer into labelled sections and does not label two things 'Time'", async () => {
    renderDrawer();
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalled());

    expect(screen.getByText("Time")).toBeTruthy();
    expect(screen.getByText("Your details")).toBeTruthy();

    // Opening seating adds an exact-time picker, which must not collide with the
    // "Time" section heading above it.
    fireEvent.press(screen.getByTestId("seating-disclosure-toggle"));
    expect(screen.getByText("Exact time")).toBeTruthy();
    expect(screen.getAllByText("Time")).toHaveLength(1);
  });

  it("summarises the privacy terms and expands the full note on request", async () => {
    renderDrawer();
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalled());
    expect(screen.getByText(/stored only to manage this reservation/)).toBeTruthy();
    expect(screen.queryByText(/essential cookie/)).toBeNull();

    fireEvent.press(screen.getByTestId("privacy-note-toggle"));
    expect(screen.getByText(/essential cookie/)).toBeTruthy();

    fireEvent.press(screen.getByTestId("privacy-note-toggle"));
    expect(screen.queryByText(/essential cookie/)).toBeNull();
  });

  it("still shows the hold banner and confirm button exactly once", async () => {
    renderDrawer();
    await waitFor(() => expect(mockFetchAvailability).toHaveBeenCalled());
    expect(screen.getAllByTestId("hold-banner")).toHaveLength(1);
    expect(screen.getAllByTestId("submit-btn")).toHaveLength(1);
    expect(screen.getByText("Confirm Booking")).toBeTruthy();
  });

  it("tracks a party size changed on the page bar without remounting", async () => {
    const { rerender } = renderDrawer();
    await waitFor(() =>
      expect(mockFetchAvailability).toHaveBeenCalledWith(expect.anything(), "2026-06-24", 4)
    );
    rerender(
      <BookingForm
        layout="drawer"
        restaurant={mockRestaurantAllDays}
        seats={7}
        date="2026-06-24"
        onSubmit={jest.fn()}
      />
    );
    await waitFor(() =>
      expect(mockFetchAvailability).toHaveBeenCalledWith(expect.anything(), "2026-06-24", 7)
    );
  });
});
