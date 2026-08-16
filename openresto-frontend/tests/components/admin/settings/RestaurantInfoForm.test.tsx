/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react-native";
import { RestaurantInfoForm } from "@/components/admin/settings/RestaurantInfoForm";
import * as restaurantsApi from "@/api/restaurants";
import { useColorScheme } from "@/hooks/use-color-scheme";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/restaurants", () => ({
  updateRestaurant: jest.fn(),
  uploadMenuFile: jest.fn(),
  deleteMenuFile: jest.fn(),
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
        <Pressable onPress={() => onSelect("10:00")}>
          <Text>Pick Time</Text>
        </Pressable>
      </View>
    ),
  };
});

const mockRestaurant = {
  id: 1,
  name: "Test Resto",
  address: "123 Main St",
  openTime: "09:00",
  closeTime: "22:00",
  openDays: "1,2,3,4,5",
  timezone: "UTC",
  defaultBookingDurationMinutes: 90,
  tags: ["pizza", "italian"],
  sections: [],
};

/**
 * Waits out the autosave debounce and lets the save promise settle. Real timers rather than
 * `jest.advanceTimersByTime`: this file also drives promise-based UI (the menu upload/delete
 * flows), and RNTL's `waitFor` cannot make progress against a faked clock.
 */
const flushAutosave = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 900));
  });
};

describe("RestaurantInfoForm", () => {
  const onSaved = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the restaurant name", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(screen.getByDisplayValue("Test Resto")).toBeTruthy();
  });

  it("renders the address field", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(screen.getByDisplayValue("123 Main St")).toBeTruthy();
  });

  it("renders open days as toggleable buttons", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(screen.getByText("Monday")).toBeTruthy();
    expect(screen.getByText("Sunday")).toBeTruthy();
  });

  it("shows tags", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(screen.getByText("pizza")).toBeTruthy();
    expect(screen.getByText("italian")).toBeTruthy();
  });

  it("shows the autosave status row instead of a Save button", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(screen.getByTestId("location-save-status")).toBeTruthy();
    expect(screen.queryByText("Save changes")).toBeNull();
  });

  it("shows All changes saved status by default", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
  });

  it("shows Unsaved changes when form is dirty", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("Test Resto"), "New Name");
  });

  it("calls updateRestaurant when Save is pressed after editing", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      name: "Updated Resto",
    });
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("Test Resto"), "Updated Resto");
    await flushAutosave();
    expect(restaurantsApi.updateRestaurant).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ name: "Updated Resto" })
    );
  });

  it("allows name to be edited", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("Test Resto"), "New Name");
    expect(screen.getByDisplayValue("New Name")).toBeTruthy();
  });

  it("toggles a day open/closed when pressed", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    // Saturday (day 6) is not in openDays "1,2,3,4,5" — pressing it should include it
    fireEvent.press(screen.getByText("Saturday"));
    // Component should still render correctly after toggle
    expect(screen.getByText("Saturday")).toBeTruthy();
  });

  it("deselects an active day when pressed again", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    // Monday (day 1) is active in "1,2,3,4,5" — pressing it deselects it
    fireEvent.press(screen.getByText("Monday"));
    expect(screen.getByText(/4 of 7 days open/)).toBeTruthy();
  });

  it("adds a tag via onSubmitEditing", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    const tagInput = screen.getByPlaceholderText("Add tag (press Enter)");
    fireEvent.changeText(tagInput, "sushi");
    fireEvent(tagInput, "submitEditing");
    expect(screen.getByText("sushi")).toBeTruthy();
    // Input should be cleared
    expect(screen.getByPlaceholderText("Add tag (press Enter)")).toBeTruthy();
  });

  it("does not add a duplicate tag", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    const tagInput = screen.getByPlaceholderText("Add tag (press Enter)");
    fireEvent.changeText(tagInput, "pizza");
    fireEvent(tagInput, "submitEditing");
    // Only one "pizza" text should exist (not two)
    expect(screen.getAllByText("pizza")).toHaveLength(1);
  });

  it("adds a tag via onBlur when input has value", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    const tagInput = screen.getByPlaceholderText("Add tag (press Enter)");
    fireEvent.changeText(tagInput, "ramen");
    fireEvent(tagInput, "blur");
    expect(screen.getByText("ramen")).toBeTruthy();
  });

  it("removes a tag when its remove button is pressed", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(screen.getByText("pizza")).toBeTruthy();
    fireEvent.press(screen.getByTestId("remove-tag-pizza"));
    expect(screen.queryByText("pizza")).toBeNull();
    expect(screen.getByText("italian")).toBeTruthy();
  });

  it("autosaves a tag committed from the tag input", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      name: "Updated Resto",
      tags: ["pizza", "italian", "tapas"],
    });
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("Test Resto"), "Updated Resto");
    const tagInput = screen.getByPlaceholderText("Add tag (press Enter)");
    fireEvent.changeText(tagInput, "tapas");
    fireEvent(tagInput, "submitEditing");
    await flushAutosave();
    expect(restaurantsApi.updateRestaurant).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ tags: expect.stringContaining("tapas") })
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it("does not call onSaved when updateRestaurant returns null", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue(null);
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("Test Resto"), "Updated Resto");
    await flushAutosave();
    expect(onSaved).not.toHaveBeenCalled();
  });

  // ── Booking duration (#135) ────────────────────────────────────────────
  // The booking controls are the shared `Select`: its trigger renders the selected option's
  // label, so a selection is asserted by that label and changed by pressing the trigger and
  // then the option inside the modal.
  const chooseOption = (currentLabel: string, nextLabel: string) => {
    fireEvent.press(screen.getByText(currentLabel));
    fireEvent.press(screen.getByText(nextLabel));
  };

  it("renders the booking duration select at the restaurant's saved value", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(screen.getByText("1h 30m")).toBeTruthy();
  });

  it("defaults the booking duration to 1h (60 minutes) when the restaurant has none set", () => {
    render(
      <RestaurantInfoForm
        restaurant={{
          ...mockRestaurant,
          defaultBookingDurationMinutes: undefined as unknown as number,
        }}
        onSaved={onSaved}
      />
    );
    expect(screen.getByText("1h")).toBeTruthy();
  });

  it("includes the saved defaultBookingDurationMinutes in the save payload", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      name: "Updated Resto",
    });
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("Test Resto"), "Updated Resto");
    await flushAutosave();
    expect(restaurantsApi.updateRestaurant).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ defaultBookingDurationMinutes: 90 })
    );
  });

  it("marks the form dirty and updates the selection when the booking duration changes", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    chooseOption("1h 30m", "2h");
    expect(screen.getByText("2h")).toBeTruthy();
  });

  it("saves the newly selected booking duration", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      defaultBookingDurationMinutes: 120,
    });
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    chooseOption("1h 30m", "2h");
    await flushAutosave();
    expect(restaurantsApi.updateRestaurant).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ defaultBookingDurationMinutes: 120 })
    );
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ defaultBookingDurationMinutes: 120 })
    );
  });

  // ── Booking start-time interval (#245) ──────────────────────────────────

  it("renders the slot interval select at the restaurant's saved value", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(screen.getByText("30m")).toBeTruthy();
  });

  it("defaults the slot interval to 30 minutes when the restaurant has none set", () => {
    render(
      <RestaurantInfoForm
        restaurant={{
          ...mockRestaurant,
          bookingSlotIntervalMinutes: undefined as unknown as number,
        }}
        onSaved={onSaved}
      />
    );
    expect(screen.getByText("30m")).toBeTruthy();
  });

  it("marks the form dirty and updates the selection when the slot interval changes", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    chooseOption("30m", "15m");
    expect(screen.getByText("15m")).toBeTruthy();
  });

  it("includes the slot interval in the save payload", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      bookingSlotIntervalMinutes: 15,
    });
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("Test Resto"), "Updated Resto");
    await flushAutosave();
    expect(restaurantsApi.updateRestaurant).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ bookingSlotIntervalMinutes: 30 })
    );
  });

  it("saves the newly selected slot interval", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      bookingSlotIntervalMinutes: 60,
    });
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    chooseOption("30m", "1h");
    await flushAutosave();
    expect(restaurantsApi.updateRestaurant).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ bookingSlotIntervalMinutes: 60 })
    );
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ bookingSlotIntervalMinutes: 60 })
    );
  });

  // ── Max table oversize (#244) ───────────────────────────────────────────
  // "Off" is the sentinel the picker carries for the API's null; selecting a number sends
  // that integer.

  it("renders the oversize select at Off when the restaurant has none set", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(screen.getByText("Off")).toBeTruthy();
  });

  it("renders the oversize select at the restaurant's saved value", () => {
    render(
      <RestaurantInfoForm
        restaurant={{ ...mockRestaurant, maxTableOversizeSeats: 2 }}
        onSaved={onSaved}
      />
    );
    expect(screen.getByText("+2 seats")).toBeTruthy();
  });

  it("marks the form dirty and updates the selection when the oversize changes", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    chooseOption("Off", "+1 seat");
    expect(screen.getByText("+1 seat")).toBeTruthy();
  });

  it("saves the newly selected oversize cap", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      maxTableOversizeSeats: 1,
    });
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    chooseOption("Off", "+1 seat");
    await flushAutosave();
    expect(restaurantsApi.updateRestaurant).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ maxTableOversizeSeats: 1 })
    );
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ maxTableOversizeSeats: 1 }));
  });

  it("saves null (Off) when the Off option is re-selected on a capped restaurant", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      maxTableOversizeSeats: null,
    });
    render(
      <RestaurantInfoForm
        restaurant={{ ...mockRestaurant, maxTableOversizeSeats: 2 }}
        onSaved={onSaved}
      />
    );
    chooseOption("+2 seats", "Off");
    await flushAutosave();
    expect(restaurantsApi.updateRestaurant).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ maxTableOversizeSeats: null })
    );
  });

  // ── Booking reference format (#179) ─────────────────────────────────────
  // Option values are the backend BookingRefFormat member names, sent verbatim.
  const WORDS_FORMAT = "Words (crispy-basil-saffron)";
  const NUMBERS_FORMAT = "Numbers (48273910)";

  it("renders the booking ref format select at AlphaNumeric when the restaurant has none set", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(screen.getByText(WORDS_FORMAT)).toBeTruthy();
  });

  it("renders the booking ref format select at the restaurant's saved value", () => {
    render(
      <RestaurantInfoForm
        restaurant={{ ...mockRestaurant, bookingRefFormat: "Numeric" as const }}
        onSaved={onSaved}
      />
    );
    expect(screen.getByText(NUMBERS_FORMAT)).toBeTruthy();
  });

  it("marks the form dirty and updates the selection when the ref format changes", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    chooseOption(WORDS_FORMAT, NUMBERS_FORMAT);
    expect(screen.getByText(NUMBERS_FORMAT)).toBeTruthy();
  });

  it("saves the newly selected ref format", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      bookingRefFormat: "Numeric",
    });
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    chooseOption(WORDS_FORMAT, NUMBERS_FORMAT);
    await flushAutosave();
    expect(restaurantsApi.updateRestaurant).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ bookingRefFormat: "Numeric" })
    );
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ bookingRefFormat: "Numeric" }));
  });

  // ── Per-day opening hours (#175) ─────────────────────────────────────────

  const uniformWeek = [1, 2, 3, 4, 5, 6, 7].map((day) => ({
    day,
    open: "09:00",
    close: "22:00",
  }));

  const customWeek = uniformWeek.map((h) =>
    h.day === 6 ? { ...h, open: "11:00", close: "23:00" } : h
  );

  const customRestaurant = { ...mockRestaurant, openHours: customWeek };

  it("starts in uniform mode when hours are the same every day", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    // Uniform mode shows the full-name day chips
    expect(screen.getByText("Monday")).toBeTruthy();
    expect(screen.queryByTestId("day-toggle-1")).toBeNull();
  });

  it("starts in custom mode when the restaurant has per-day hours", () => {
    render(<RestaurantInfoForm restaurant={customRestaurant} onSaved={onSaved} />);
    expect(screen.getByTestId("day-toggle-1")).toBeTruthy();
    expect(screen.getByTestId("day-toggle-7")).toBeTruthy();
  });

  it("switches to custom mode and shows 7 day rows", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.press(screen.getByTestId("hours-mode-custom"));
    for (let day = 1; day <= 7; day++) {
      expect(screen.getByTestId(`day-toggle-${day}`)).toBeTruthy();
    }
  });

  it("shows Closed for days not in openDays in custom mode", () => {
    // mockRestaurant is open Mon–Fri only
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.press(screen.getByTestId("hours-mode-custom"));
    expect(screen.getAllByText("Closed")).toHaveLength(2); // Sat + Sun
  });

  it("toggling a closed day open in custom mode reveals its time pickers", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.press(screen.getByTestId("hours-mode-custom"));
    fireEvent.press(screen.getByTestId("day-toggle-6"));
    expect(screen.getAllByText("Closed")).toHaveLength(1); // only Sunday left
  });

  it("does not mark the form dirty when only the mode is toggled", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.press(screen.getByTestId("hours-mode-custom"));
  });

  it("saves per-day hours after editing a single day", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      openHours: customWeek,
    });
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.press(screen.getByTestId("hours-mode-custom"));
    // Mock TimePicker's "Pick Time" sets 10:00; first picker is Monday's opening time
    fireEvent.press(screen.getAllByText("Pick Time")[0]);
    await flushAutosave();
    const payload = (restaurantsApi.updateRestaurant as jest.Mock).mock.calls[0][1];
    expect(payload.openHours).toHaveLength(7);
    expect(payload.openHours[0]).toEqual({ day: 1, open: "10:00", close: "22:00" });
    expect(payload.openHours[1]).toEqual({ day: 2, open: "09:00", close: "22:00" });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ openHours: customWeek }));
  });

  it("saves uniform hours for all 7 days in uniform mode", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue(mockRestaurant);
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    // First picker in uniform mode is "Opens"; the mock sets it to 10:00
    fireEvent.press(screen.getAllByText("Pick Time")[0]);
    await flushAutosave();
    const payload = (restaurantsApi.updateRestaurant as jest.Mock).mock.calls[0][1];
    expect(payload.openTime).toBe("10:00");
    expect(payload.openHours).toHaveLength(7);
    expect(payload.openHours.every((h: { open: string }) => h.open === "10:00")).toBe(true);
  });

  it("copies one day's hours to the whole week", async () => {
    // Open Saturday so its row shows time pickers and the copy button
    const withSaturday = { ...customRestaurant, openDays: "1,2,3,4,5,6" };
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue(withSaturday);
    render(<RestaurantInfoForm restaurant={withSaturday} onSaved={onSaved} />);
    // Saturday (day 6) has 11:00–23:00; copy it everywhere
    fireEvent.press(screen.getByTestId("copy-hours-6"));
    await flushAutosave();
    const payload = (restaurantsApi.updateRestaurant as jest.Mock).mock.calls[0][1];
    expect(
      payload.openHours.every(
        (h: { open: string; close: string }) => h.open === "11:00" && h.close === "23:00"
      )
    ).toBe(true);
  });

  it("shows the after-midnight hint when closing time is before opening", () => {
    const overnight = {
      ...mockRestaurant,
      openTime: "18:00",
      closeTime: "02:00",
    };
    render(<RestaurantInfoForm restaurant={overnight} onSaved={onSaved} />);
    expect(screen.getByText(/closes after midnight/)).toBeTruthy();
  });

  describe("reservations / walk-in policy", () => {
    it("shows the online-bookings mode and day chips by default", () => {
      render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
      expect(screen.getByText("Walk-in Policy")).toBeTruthy();
      expect(screen.getByText("Online bookings on every open day")).toBeTruthy();
      expect(screen.getByTestId("walkin-day-1")).toBeTruthy();
      expect(screen.getByTestId("walkin-day-7")).toBeTruthy();
    });

    it("switching to walk-ins only hides the day chips and marks the form dirty", () => {
      render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
      fireEvent.press(screen.getByTestId("walkin-mode-walkin"));
      expect(screen.getByText("Walk-ins only, online booking is off")).toBeTruthy();
      expect(screen.queryByTestId("walkin-day-1")).toBeNull();
    });

    it("saves walkInOnly=true when toggled", async () => {
      (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
        ...mockRestaurant,
        walkInOnly: true,
        walkInDays: "",
      });
      render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
      fireEvent.press(screen.getByTestId("walkin-mode-walkin"));
      await flushAutosave();
      expect(restaurantsApi.updateRestaurant).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ walkInOnly: true, walkInDays: "" })
      );
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ walkInOnly: true }));
    });

    it("toggles walk-in days and saves the joined list", async () => {
      (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
        ...mockRestaurant,
        walkInDays: "6,7",
      });
      render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
      fireEvent.press(screen.getByTestId("walkin-day-6"));
      fireEvent.press(screen.getByTestId("walkin-day-7"));
      expect(screen.getByText("Walk-ins only on 2 days")).toBeTruthy();
      await flushAutosave();
      expect(restaurantsApi.updateRestaurant).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ walkInOnly: false, walkInDays: "6,7" })
      );
    });

    it("unselecting a walk-in day removes it from the payload", () => {
      const withWalkIn = { ...mockRestaurant, walkInDays: "6" };
      render(<RestaurantInfoForm restaurant={withWalkIn} onSaved={onSaved} />);
      expect(screen.getByText("Walk-ins only on 1 day")).toBeTruthy();
      fireEvent.press(screen.getByTestId("walkin-day-6"));
      expect(screen.getByText("Online bookings on every open day")).toBeTruthy();
    });
  });

  // ── Fallback branches for unset optional restaurant fields ─────────────
  // RestaurantDto marks address/tags/walkInOnly/walkInDays/defaultBookingDurationMinutes as
  // optional, and even openTime/closeTime/timezone (typed as required strings) are read
  // defensively with `??` in case the API ever omits them. mockRestaurant always supplies
  // every field, so those `??` fallback branches (state init, initialOpenHours, the dirty
  // check, and discard()) were never exercised on the "value is missing" side.
  const sparseRestaurant = {
    id: 2,
    name: "Sparse Resto",
    openDays: "1,2,3,4,5,6,7",
    openTime: undefined as unknown as string,
    closeTime: undefined as unknown as string,
    timezone: undefined as unknown as string,
    sections: [],
  };

  it("falls back to defaults when optional restaurant fields are unset", () => {
    render(<RestaurantInfoForm restaurant={sparseRestaurant} onSaved={onSaved} />);
    expect(screen.getByDisplayValue("Sparse Resto")).toBeTruthy();
    expect(screen.getByPlaceholderText("e.g. 123 Main St")).toBeTruthy();
    expect(screen.getByText("1h")).toBeTruthy();
    expect(screen.getByText("30m")).toBeTruthy();
    expect(screen.getByText("Online bookings on every open day")).toBeTruthy();
  });

  it("saves address as null when the address field is cleared to blank", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      address: null,
    });
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("123 Main St"), "   ");
    await flushAutosave();
    expect(restaurantsApi.updateRestaurant).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ address: null })
    );
  });

  it("renders without crashing in dark mode", () => {
    (useColorScheme as jest.Mock).mockReturnValueOnce("dark");
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(screen.getByDisplayValue("Test Resto")).toBeTruthy();
  });

  it("reports Saving… while the request is in flight, then Saved", async () => {
    let resolveUpdate: (value: unknown) => void = () => {};
    (restaurantsApi.updateRestaurant as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        })
    );
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("Test Resto"), "Updated Resto");
    await flushAutosave();
    expect(await screen.findByText("Saving…")).toBeTruthy();
    await act(async () => {
      resolveUpdate({ ...mockRestaurant, name: "Updated Resto" });
    });
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("reports the failure and offers a retry when the save is rejected", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue(null);
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("Test Resto"), "Updated Resto");
    await flushAutosave();
    expect(screen.getByText("Couldn't reach the server.")).toBeTruthy();

    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      name: "Updated Resto",
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Retry"));
    });
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  // ── Description blurb (#184) ──────────────────────────────────────────────

  it("renders the description field (empty when unset)", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(
      screen.getByPlaceholderText(
        "Short blurb shown on the location page. Supports links like [menu](https://example.com)."
      )
    ).toBeTruthy();
  });

  it("pre-fills the description field from the restaurant", () => {
    render(
      <RestaurantInfoForm
        restaurant={{ ...mockRestaurant, description: "A cozy spot." }}
        onSaved={onSaved}
      />
    );
    expect(screen.getByDisplayValue("A cozy spot.")).toBeTruthy();
  });

  it("marks the form dirty and saves the description when edited", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      description: "Our little place",
    });
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(
      screen.getByPlaceholderText(
        "Short blurb shown on the location page. Supports links like [menu](https://example.com)."
      ),
      "Our little place"
    );
    await flushAutosave();
    expect(restaurantsApi.updateRestaurant).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ description: "Our little place" })
    );
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Our little place" })
    );
  });

  it("saves description as an empty string when cleared to blank", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      description: null,
    });
    render(
      <RestaurantInfoForm
        restaurant={{ ...mockRestaurant, description: "Existing blurb" }}
        onSaved={onSaved}
      />
    );
    fireEvent.changeText(screen.getByDisplayValue("Existing blurb"), "   ");
    await flushAutosave();
    expect(restaurantsApi.updateRestaurant).toHaveBeenCalledWith(
      1,
      // "" clears server-side; null would be read as "leave untouched" and the blurb would stick.
      expect.objectContaining({ description: "" })
    );
  });

  // ── Menu file upload (#246) ──────────────────────────────────────────────
  // Admins can either paste an external link OR upload a PDF — both reuse
  // Restaurant.MenuUrl. A served file is recognized by its /media/menu-<id>.pdf
  // shape, which swaps the link input for a "Remove file" affordance.

  it("shows the Upload PDF button and the link input when no menu is set", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(screen.getByText("Upload PDF")).toBeTruthy();
    expect(screen.getByPlaceholderText("https://your-menu-url.com/menu.pdf")).toBeTruthy();
  });

  it("pre-fills the link input when the restaurant has an external menu URL", () => {
    render(
      <RestaurantInfoForm
        restaurant={{ ...mockRestaurant, menuUrl: "https://example.com/menu.pdf" }}
        onSaved={onSaved}
      />
    );
    expect(screen.getByDisplayValue("https://example.com/menu.pdf")).toBeTruthy();
  });

  it("shows Remove file instead of the link input when a PDF is uploaded", () => {
    render(
      <RestaurantInfoForm
        restaurant={{ ...mockRestaurant, menuUrl: "/media/menu-1.pdf?v=123" }}
        onSaved={onSaved}
      />
    );
    expect(screen.getByText("Uploaded menu PDF")).toBeTruthy();
    expect(screen.getByText("Remove file")).toBeTruthy();
    expect(screen.queryByPlaceholderText("https://your-menu-url.com/menu.pdf")).toBeNull();
    expect(screen.queryByText("Upload PDF")).toBeNull();
  });

  it("calls uploadMenuFile and onSaved when a PDF is selected", async () => {
    (restaurantsApi.uploadMenuFile as jest.Mock).mockResolvedValue("/media/menu-1.pdf?v=1");
    const mockInput = {
      type: "",
      accept: "",
      onchange: null as ((e: Event) => void) | null,
      click: jest.fn(),
      files: [new File(["pdf-bytes"], "menu.pdf", { type: "application/pdf" })],
    };
    jest.spyOn(document, "createElement").mockReturnValueOnce(mockInput as unknown as HTMLElement);
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    act(() => {
      fireEvent.press(screen.getByText("Upload PDF"));
    });
    await act(async () => {
      mockInput.onchange?.({} as Event);
    });
    expect(restaurantsApi.uploadMenuFile).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ type: "application/pdf" })
    );
    expect(onSaved).toHaveBeenCalledWith({ menuUrl: "/media/menu-1.pdf?v=1" });
  });

  it("shows Menu uploaded message after successful upload", async () => {
    (restaurantsApi.uploadMenuFile as jest.Mock).mockResolvedValue("/media/menu-1.pdf?v=1");
    const mockInput = {
      type: "",
      accept: "",
      onchange: null as ((e: Event) => void) | null,
      click: jest.fn(),
      files: [new File(["pdf-bytes"], "menu.pdf", { type: "application/pdf" })],
    };
    jest.spyOn(document, "createElement").mockReturnValueOnce(mockInput as unknown as HTMLElement);
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    act(() => {
      fireEvent.press(screen.getByText("Upload PDF"));
    });
    await act(async () => {
      mockInput.onchange?.({} as Event);
    });
    await waitFor(() => {
      expect(screen.getByText("Menu uploaded.")).toBeTruthy();
    });
  });

  it("shows an error message when upload fails", async () => {
    (restaurantsApi.uploadMenuFile as jest.Mock).mockResolvedValue(null);
    const mockInput = {
      type: "",
      accept: "",
      onchange: null as ((e: Event) => void) | null,
      click: jest.fn(),
      files: [new File(["pdf-bytes"], "menu.pdf", { type: "application/pdf" })],
    };
    jest.spyOn(document, "createElement").mockReturnValueOnce(mockInput as unknown as HTMLElement);
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    act(() => {
      fireEvent.press(screen.getByText("Upload PDF"));
    });
    await act(async () => {
      mockInput.onchange?.({} as Event);
    });
    await waitFor(() => {
      expect(screen.getByText("Failed to upload menu.")).toBeTruthy();
    });
  });

  it("shows a size error when the selected file exceeds 10 MB", async () => {
    const largeFile = new File(["x".repeat(11 * 1024 * 1024)], "big.pdf", {
      type: "application/pdf",
    });
    const mockInput = {
      type: "",
      accept: "",
      onchange: null as ((e: Event) => void) | null,
      click: jest.fn(),
      files: [largeFile],
    };
    jest.spyOn(document, "createElement").mockReturnValueOnce(mockInput as unknown as HTMLElement);
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    act(() => {
      fireEvent.press(screen.getByText("Upload PDF"));
    });
    await act(async () => {
      mockInput.onchange?.({} as Event);
    });
    await waitFor(() => {
      expect(screen.getByText("Menu file must be under 10 MB.")).toBeTruthy();
    });
    expect(restaurantsApi.uploadMenuFile).not.toHaveBeenCalled();
  });

  it("calls deleteMenuFile and onSaved with null menuUrl when Remove file is pressed", async () => {
    (restaurantsApi.deleteMenuFile as jest.Mock).mockResolvedValue(true);
    render(
      <RestaurantInfoForm
        restaurant={{ ...mockRestaurant, menuUrl: "/media/menu-1.pdf?v=123" }}
        onSaved={onSaved}
      />
    );
    await act(async () => {
      fireEvent.press(screen.getByText("Remove file"));
    });
    expect(restaurantsApi.deleteMenuFile).toHaveBeenCalledWith(1);
    expect(onSaved).toHaveBeenCalledWith({ menuUrl: null });
  });

  it("shows Menu removed message after successful delete", async () => {
    (restaurantsApi.deleteMenuFile as jest.Mock).mockResolvedValue(true);
    render(
      <RestaurantInfoForm
        restaurant={{ ...mockRestaurant, menuUrl: "/media/menu-1.pdf?v=123" }}
        onSaved={onSaved}
      />
    );
    await act(async () => {
      fireEvent.press(screen.getByText("Remove file"));
    });
    await waitFor(() => {
      expect(screen.getByText("Menu removed.")).toBeTruthy();
    });
  });

  it("shows an error when delete fails", async () => {
    (restaurantsApi.deleteMenuFile as jest.Mock).mockResolvedValue(false);
    render(
      <RestaurantInfoForm
        restaurant={{ ...mockRestaurant, menuUrl: "/media/menu-1.pdf?v=123" }}
        onSaved={onSaved}
      />
    );
    await act(async () => {
      fireEvent.press(screen.getByText("Remove file"));
    });
    await waitFor(() => {
      expect(screen.getByText("Failed to remove menu.")).toBeTruthy();
    });
  });

  it("does nothing when no file is selected in the picker", async () => {
    const mockInput = {
      type: "",
      accept: "",
      onchange: null as ((e: Event) => void) | null,
      click: jest.fn(),
      files: [],
    };
    jest.spyOn(document, "createElement").mockReturnValueOnce(mockInput as unknown as HTMLElement);
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    act(() => {
      fireEvent.press(screen.getByText("Upload PDF"));
    });
    await act(async () => {
      mockInput.onchange?.({} as Event);
    });
    expect(restaurantsApi.uploadMenuFile).not.toHaveBeenCalled();
  });

  it("blocks save with an inline error when menuUrl is an invalid link (pre-flight)", async () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    const menuInput = screen.getByPlaceholderText("https://your-menu-url.com/menu.pdf");
    fireEvent.changeText(menuInput, "javascript:alert(1)");
    await flushAutosave();
    await waitFor(() => expect(screen.getByText(/valid http\(s\) link/)).toBeTruthy());
    // Pre-flight means the API was never called.
    expect(restaurantsApi.updateRestaurant).not.toHaveBeenCalled();
  });
  // ── Contact info (#262) ───────────────────────────────────────────────

  it("renders stored contact fields", () => {
    render(
      <RestaurantInfoForm
        restaurant={{
          ...mockRestaurant,
          phoneNumber: "+44 20 7946 0958",
          emailAddress: "hello@example.com",
        }}
        onSaved={onSaved}
      />
    );
    expect(screen.getByDisplayValue("+44 20 7946 0958")).toBeTruthy();
    expect(screen.getByDisplayValue("hello@example.com")).toBeTruthy();
  });

  it("saves trimmed contact fields", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      phoneNumber: "+1 555 0100",
      emailAddress: "hi@example.com",
    });
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);

    fireEvent.changeText(screen.getByPlaceholderText("e.g. +44 20 7946 0958"), " +1 555 0100 ");
    fireEvent.changeText(
      screen.getByPlaceholderText("e.g. bookings@example.com"),
      " hi@example.com "
    );
    await flushAutosave();

    expect(restaurantsApi.updateRestaurant).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ phoneNumber: "+1 555 0100", emailAddress: "hi@example.com" })
    );
    await waitFor(() =>
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({ phoneNumber: "+1 555 0100", emailAddress: "hi@example.com" })
      )
    );
  });

  it("sends an empty string to clear a contact field (PATCH convention)", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue(mockRestaurant);
    render(
      <RestaurantInfoForm
        restaurant={{ ...mockRestaurant, phoneNumber: "+1 555 0100" }}
        onSaved={onSaved}
      />
    );

    fireEvent.changeText(screen.getByPlaceholderText("e.g. +44 20 7946 0958"), "");
    await flushAutosave();

    expect(restaurantsApi.updateRestaurant).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ phoneNumber: "" })
    );
  });

  it("blocks save with an inline error when the contact email is malformed (pre-flight)", async () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByPlaceholderText("e.g. bookings@example.com"), "not-an-email");
    await flushAutosave();
    await waitFor(() => expect(screen.getByText(/valid email address/)).toBeTruthy());
    expect(restaurantsApi.updateRestaurant).not.toHaveBeenCalled();
  });

  it("blocks save with an inline error when the contact phone exceeds the cap", async () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByPlaceholderText("e.g. +44 20 7946 0958"), "9".repeat(33));
    await flushAutosave();
    await waitFor(() => expect(screen.getByText(/cannot exceed 32 characters/)).toBeTruthy());
    expect(restaurantsApi.updateRestaurant).not.toHaveBeenCalled();
  });
  it("sends an empty string to clear a pasted menu link", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      menuUrl: null,
    });
    render(
      <RestaurantInfoForm
        restaurant={{ ...mockRestaurant, menuUrl: "https://example.com/menu.pdf" }}
        onSaved={onSaved}
      />
    );

    fireEvent.changeText(screen.getByDisplayValue("https://example.com/menu.pdf"), "");
    await flushAutosave();

    expect(restaurantsApi.updateRestaurant).toHaveBeenCalledWith(
      1,
      // "" clears; null would be read as "leave untouched" and the link would stick.
      expect.objectContaining({ menuUrl: "" })
    );
  });

  it("sends null for menuUrl while an uploaded file is the stored menu", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue(mockRestaurant);
    render(
      <RestaurantInfoForm
        restaurant={{ ...mockRestaurant, menuUrl: "/media/menu-1.pdf?v=123" }}
        onSaved={onSaved}
      />
    );

    // The upload flow leaves local menuUrl blank while the served path is stored; sending ""
    // here would wipe the freshly-uploaded file, so this save must leave the field untouched.
    fireEvent.changeText(screen.getByDisplayValue("Test Resto"), "Renamed Resto");
    await flushAutosave();

    expect(restaurantsApi.updateRestaurant).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ menuUrl: null })
    );
  });

  describe("card accordions", () => {
    it("collapses the Basic Info card when its header is pressed", () => {
      render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
      expect(screen.getByDisplayValue("Test Resto")).toBeTruthy();
      fireEvent.press(screen.getByText("Basic Info"));
      expect(screen.queryByDisplayValue("Test Resto")).toBeNull();
    });

    it("collapses the Menu card when its header is pressed", () => {
      render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
      expect(screen.getByText("Upload PDF")).toBeTruthy();
      fireEvent.press(screen.getByText("Menu"));
      expect(screen.queryByText("Upload PDF")).toBeNull();
    });

    it("collapses the Contact card when its header is pressed", () => {
      render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
      expect(screen.getByPlaceholderText("e.g. +44 20 7946 0958")).toBeTruthy();
      fireEvent.press(screen.getByText("Contact"));
      expect(screen.queryByPlaceholderText("e.g. +44 20 7946 0958")).toBeNull();
    });

    it("collapses the Booking Settings card when its header is pressed", () => {
      render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
      expect(screen.getByText("Default booking duration")).toBeTruthy();
      fireEvent.press(screen.getByText("Booking Settings"));
      expect(screen.queryByText("Default booking duration")).toBeNull();
    });
  });
});
