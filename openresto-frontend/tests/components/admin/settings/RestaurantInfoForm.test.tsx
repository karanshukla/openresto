import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react-native";
import { RestaurantInfoForm } from "@/components/admin/settings/RestaurantInfoForm";
import * as restaurantsApi from "@/api/restaurants";
import { useColorScheme } from "@/hooks/use-color-scheme";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/api/restaurants", () => ({
  updateRestaurant: jest.fn(),
}));

jest.mock("@/context/BrandContext", () => {
  const brand = { primaryColor: "#0a7ea4", appName: "Open Resto" };
  return { useBrand: () => brand };
});

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
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

  it("shows Save button", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(screen.getByText("Save changes")).toBeTruthy();
  });

  it("shows All changes saved status by default", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(screen.getByText("All changes saved")).toBeTruthy();
  });

  it("shows Unsaved changes when form is dirty", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("Test Resto"), "New Name");
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
  });

  it("calls updateRestaurant when Save is pressed after editing", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      name: "Updated Resto",
    });
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("Test Resto"), "Updated Resto");
    await act(async () => {
      fireEvent.press(screen.getByText("Save changes"));
    });
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
    expect(screen.getByText("4 of 7 days open")).toBeTruthy();
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

  it("discards changes when Discard is pressed", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("Test Resto"), "Changed Name");
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    fireEvent.press(screen.getByText("Discard"));
    expect(screen.getByDisplayValue("Test Resto")).toBeTruthy();
    expect(screen.getByText("All changes saved")).toBeTruthy();
  });

  it("flushes pending tag input when saving", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      name: "Updated Resto",
      tags: ["pizza", "italian", "tapas"],
    });
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("Test Resto"), "Updated Resto");
    const tagInput = screen.getByPlaceholderText("Add tag (press Enter)");
    fireEvent.changeText(tagInput, "tapas");
    await act(async () => {
      fireEvent.press(screen.getByText("Save changes"));
    });
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
    await act(async () => {
      fireEvent.press(screen.getByText("Save changes"));
    });
    expect(onSaved).not.toHaveBeenCalled();
  });

  // ── Booking duration (#135) ────────────────────────────────────────────
  // The duration control is a raw web `<select>`, not a React Native primitive, so `testID`
  // does not forward to a queryable DOM attribute the way it does for View/Text (see
  // TimePicker.web.tsx's `data-testid` convention for the same reason). Query it via
  // UNSAFE_getByProps against the `data-testid` prop instead of getByTestId.
  const getDurationSelect = () =>
    screen.UNSAFE_getByProps({ "data-testid": "booking-duration-select" });

  it("renders the booking duration select at the restaurant's saved value", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    expect(getDurationSelect().props.value).toBe(90);
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
    expect(getDurationSelect().props.value).toBe(60);
  });

  it("includes the saved defaultBookingDurationMinutes in the save payload", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      name: "Updated Resto",
    });
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("Test Resto"), "Updated Resto");
    await act(async () => {
      fireEvent.press(screen.getByText("Save changes"));
    });
    expect(restaurantsApi.updateRestaurant).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ defaultBookingDurationMinutes: 90 })
    );
  });

  it("marks the form dirty and updates the selection when the booking duration changes", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    const select = getDurationSelect();
    fireEvent(select, "change", { target: { value: "120" } });
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    expect(getDurationSelect().props.value).toBe(120);
  });

  it("saves the newly selected booking duration", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      defaultBookingDurationMinutes: 120,
    });
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    const select = getDurationSelect();
    fireEvent(select, "change", { target: { value: "120" } });
    await act(async () => {
      fireEvent.press(screen.getByText("Save changes"));
    });
    expect(restaurantsApi.updateRestaurant).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ defaultBookingDurationMinutes: 120 })
    );
    expect(onSaved).toHaveBeenCalledWith(
      expect.objectContaining({ defaultBookingDurationMinutes: 120 })
    );
  });

  it("reverts the booking duration to the saved value when Discard is pressed", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    const select = getDurationSelect();
    fireEvent(select, "change", { target: { value: "120" } });
    expect(getDurationSelect().props.value).toBe(120);
    fireEvent.press(screen.getByText("Discard"));
    expect(getDurationSelect().props.value).toBe(90);
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
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
  });

  it("does not mark the form dirty when only the mode is toggled", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.press(screen.getByTestId("hours-mode-custom"));
    expect(screen.getByText("All changes saved")).toBeTruthy();
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
    await act(async () => {
      fireEvent.press(screen.getByText("Save changes"));
    });
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
    await act(async () => {
      fireEvent.press(screen.getByText("Save changes"));
    });
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
    await act(async () => {
      fireEvent.press(screen.getByText("Save changes"));
    });
    const payload = (restaurantsApi.updateRestaurant as jest.Mock).mock.calls[0][1];
    expect(
      payload.openHours.every(
        (h: { open: string; close: string }) => h.open === "11:00" && h.close === "23:00"
      )
    ).toBe(true);
  });

  it("discard restores the original per-day hours and mode", () => {
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.press(screen.getByTestId("hours-mode-custom"));
    fireEvent.press(screen.getByTestId("day-toggle-6"));
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    fireEvent.press(screen.getByText("Discard"));
    expect(screen.getByText("All changes saved")).toBeTruthy();
    // Back to uniform mode chips
    expect(screen.getByText("Monday")).toBeTruthy();
    expect(screen.queryByTestId("day-toggle-1")).toBeNull();
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
      expect(screen.getByText("Reservations")).toBeTruthy();
      expect(screen.getByText("Online bookings on every open day")).toBeTruthy();
      expect(screen.getByTestId("walkin-day-1")).toBeTruthy();
      expect(screen.getByTestId("walkin-day-7")).toBeTruthy();
    });

    it("switching to walk-ins only hides the day chips and marks the form dirty", () => {
      render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
      fireEvent.press(screen.getByTestId("walkin-mode-walkin"));
      expect(screen.getByText("Unsaved changes")).toBeTruthy();
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
      await act(async () => {
        fireEvent.press(screen.getByText("Save changes"));
      });
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
      await act(async () => {
        fireEvent.press(screen.getByText("Save changes"));
      });
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
      expect(screen.getByText("Unsaved changes")).toBeTruthy();
    });

    it("discard restores the saved walk-in policy", () => {
      const withWalkIn = { ...mockRestaurant, walkInOnly: true };
      render(<RestaurantInfoForm restaurant={withWalkIn} onSaved={onSaved} />);
      fireEvent.press(screen.getByTestId("walkin-mode-bookings"));
      expect(screen.getByText("Unsaved changes")).toBeTruthy();
      fireEvent.press(screen.getByText("Discard"));
      expect(screen.getByText("All changes saved")).toBeTruthy();
      expect(screen.getByText("Walk-ins only, online booking is off")).toBeTruthy();
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
    expect(getDurationSelect().props.value).toBe(60);
    expect(screen.getByText("Online bookings on every open day")).toBeTruthy();
    expect(screen.getByText("All changes saved")).toBeTruthy();
  });

  it("discard restores fallback defaults when optional restaurant fields are unset", () => {
    render(<RestaurantInfoForm restaurant={sparseRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("Sparse Resto"), "Changed Name");
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    fireEvent.press(screen.getByText("Discard"));
    expect(screen.getByDisplayValue("Sparse Resto")).toBeTruthy();
    expect(screen.getByText("All changes saved")).toBeTruthy();
  });

  it("saves address as null when the address field is cleared to blank", async () => {
    (restaurantsApi.updateRestaurant as jest.Mock).mockResolvedValue({
      ...mockRestaurant,
      address: null,
    });
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("123 Main St"), "   ");
    await act(async () => {
      fireEvent.press(screen.getByText("Save changes"));
    });
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

  it("shows the Saving… label while the update request is in flight", async () => {
    let resolveUpdate: (value: unknown) => void = () => {};
    (restaurantsApi.updateRestaurant as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpdate = resolve;
        })
    );
    render(<RestaurantInfoForm restaurant={mockRestaurant} onSaved={onSaved} />);
    fireEvent.changeText(screen.getByDisplayValue("Test Resto"), "Updated Resto");
    fireEvent.press(screen.getByText("Save changes"));
    expect(await screen.findByText("Saving…")).toBeTruthy();
    await act(async () => {
      resolveUpdate({ ...mockRestaurant, name: "Updated Resto" });
    });
    expect(screen.getByText("Save changes")).toBeTruthy();
  });
});
