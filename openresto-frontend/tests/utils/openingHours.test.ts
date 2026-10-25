import {
  bookingTimePickerBounds,
  getHoursForDay,
  getHoursForDate,
  getIsoDayFromDateString,
  getLastBookingForDate,
  getLastBookingForDay,
  getNextOpening,
  hasCustomHours,
  isWithinServiceWindow,
  isoDayShortName,
  lastBookingOptions,
  parseOpenDays,
  summarizeHours,
} from "@/utils/openingHours";

const uniformRestaurant = {
  openTime: "09:00",
  closeTime: "22:00",
  openHours: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ day, open: "09:00", close: "22:00" })),
};

const customRestaurant = {
  openTime: "09:00",
  closeTime: "22:00",
  openHours: [
    { day: 1, open: "09:00", close: "22:00" },
    { day: 2, open: "09:00", close: "22:00" },
    { day: 3, open: "09:00", close: "22:00" },
    { day: 4, open: "09:00", close: "22:00" },
    { day: 5, open: "09:00", close: "23:00" },
    { day: 6, open: "11:00", close: "23:30" },
    { day: 7, open: "12:00", close: "16:00" },
  ],
};

describe("getHoursForDay", () => {
  it("returns the per-day entry when present", () => {
    expect(getHoursForDay(customRestaurant, 6)).toEqual({ open: "11:00", close: "23:30" });
  });

  it("falls back to openTime/closeTime when openHours is missing", () => {
    expect(getHoursForDay({ openTime: "10:00", closeTime: "20:00" }, 3)).toEqual({
      open: "10:00",
      close: "20:00",
    });
  });

  it("falls back to defaults when nothing is set", () => {
    expect(getHoursForDay({}, 1)).toEqual({ open: "09:00", close: "22:00" });
  });

  it("falls back for a day missing from openHours", () => {
    const partial = {
      openTime: "08:00",
      closeTime: "18:00",
      openHours: [{ day: 6, open: "11:00", close: "23:00" }],
    };
    expect(getHoursForDay(partial, 2)).toEqual({ open: "08:00", close: "18:00" });
  });
});

describe("getIsoDayFromDateString", () => {
  it("maps Monday to 1", () => {
    expect(getIsoDayFromDateString("2026-06-01")).toBe(1);
  });

  it("maps Sunday to 7", () => {
    expect(getIsoDayFromDateString("2026-06-07")).toBe(7);
  });

  it("maps Saturday to 6", () => {
    expect(getIsoDayFromDateString("2026-10-10")).toBe(6);
  });
});

describe("getHoursForDate", () => {
  it("resolves hours via the date's day of week", () => {
    expect(getHoursForDate(customRestaurant, "2026-10-10")).toEqual({
      open: "11:00",
      close: "23:30",
    });
  });
});

describe("parseOpenDays", () => {
  it("parses a comma-separated list", () => {
    expect(parseOpenDays("1,2,3")).toEqual([1, 2, 3]);
  });

  it("ignores out-of-range values", () => {
    expect(parseOpenDays("0,1,8,7")).toEqual([1, 7]);
  });

  it("returns all days for empty or missing input", () => {
    expect(parseOpenDays(undefined)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(parseOpenDays("")).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(parseOpenDays("nope")).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe("hasCustomHours", () => {
  it("is false when hours are uniform", () => {
    expect(hasCustomHours(uniformRestaurant)).toBe(false);
  });

  it("is true when any day differs", () => {
    expect(hasCustomHours(customRestaurant)).toBe(true);
  });

  it("is false when openHours is missing or empty", () => {
    expect(hasCustomHours({})).toBe(false);
    expect(hasCustomHours({ openHours: [] })).toBe(false);
  });

  it("is true when only a day's last booking time differs", () => {
    const week = uniformRestaurant.openHours.map((h) =>
      h.day === 5 ? { ...h, lastBooking: "20:15" } : h
    );
    expect(hasCustomHours({ openHours: week })).toBe(true);
  });

  it("treats a null and a missing last booking as the same", () => {
    const week = uniformRestaurant.openHours.map((h) =>
      h.day === 5 ? { ...h, lastBooking: null } : h
    );
    expect(hasCustomHours({ openHours: week })).toBe(false);
  });
});

describe("getLastBookingForDay", () => {
  const withCutoffs = {
    ...uniformRestaurant,
    lastBookingTime: "20:15",
    openHours: uniformRestaurant.openHours.map((h) =>
      h.day === 6 ? { ...h, lastBooking: "21:00" } : h
    ),
  };

  it("uses the day's own value over the restaurant-wide one", () => {
    expect(getLastBookingForDay(withCutoffs, 6)).toBe("21:00");
  });

  it("falls back to the restaurant-wide value", () => {
    expect(getLastBookingForDay(withCutoffs, 2)).toBe("20:15");
  });

  it("is null when neither is set", () => {
    expect(getLastBookingForDay(uniformRestaurant, 2)).toBeNull();
    expect(getLastBookingForDay({ lastBookingTime: "" }, 2)).toBeNull();
  });

  it("resolves through a date", () => {
    expect(getLastBookingForDate(withCutoffs, "2026-10-10")).toBe("21:00");
  });
});

describe("isWithinServiceWindow", () => {
  it("includes the opening time and excludes the closing time", () => {
    expect(isWithinServiceWindow("09:00", "22:00", "09:00")).toBe(true);
    expect(isWithinServiceWindow("09:00", "22:00", "21:45")).toBe(true);
    expect(isWithinServiceWindow("09:00", "22:00", "22:00")).toBe(false);
    expect(isWithinServiceWindow("09:00", "22:00", "08:45")).toBe(false);
  });

  it("wraps past midnight when close is before open", () => {
    expect(isWithinServiceWindow("18:00", "02:00", "23:30")).toBe(true);
    expect(isWithinServiceWindow("18:00", "02:00", "01:45")).toBe(true);
    expect(isWithinServiceWindow("18:00", "02:00", "02:00")).toBe(false);
    expect(isWithinServiceWindow("18:00", "02:00", "12:00")).toBe(false);
  });

  it("covers every time when open and close match", () => {
    expect(isWithinServiceWindow("00:00", "00:00", "13:00")).toBe(true);
  });
});

describe("lastBookingOptions", () => {
  it("runs from opening to a quarter before close", () => {
    expect(lastBookingOptions("18:00", "19:00")).toEqual(["18:00", "18:15", "18:30", "18:45"]);
  });

  it("continues into the next morning for an overnight window", () => {
    const options = lastBookingOptions("23:00", "01:00");
    expect(options[0]).toBe("23:00");
    expect(options).toContain("23:45");
    expect(options).toContain("00:00");
    expect(options[options.length - 1]).toBe("00:45");
  });

  it("offers the whole day when open and close match", () => {
    const options = lastBookingOptions("00:00", "00:00");
    expect(options).toHaveLength(96);
    expect(options[95]).toBe("23:45");
  });
});

describe("bookingTimePickerBounds", () => {
  it("runs from open to close with no last booking time", () => {
    expect(bookingTimePickerBounds({ open: "11:00", close: "22:00", lastBooking: null })).toEqual({
      min: "11:00",
      max: "22:00",
    });
  });

  it("caps the picker at a last booking time before close", () => {
    expect(
      bookingTimePickerBounds({ open: "11:00", close: "22:00", lastBooking: "20:15" })
    ).toEqual({
      min: "11:00",
      max: "20:15",
    });
  });

  it("runs to the end of the day for an overnight service", () => {
    expect(bookingTimePickerBounds({ open: "18:00", close: "02:00", lastBooking: null })).toEqual({
      min: "18:00",
      max: "23:45",
    });
  });

  it("caps an overnight picker at a last booking before midnight, not one after it", () => {
    expect(
      bookingTimePickerBounds({ open: "18:00", close: "02:00", lastBooking: "23:00" }).max
    ).toBe("23:00");
    expect(
      bookingTimePickerBounds({ open: "18:00", close: "02:00", lastBooking: "00:30" }).max
    ).toBe("23:45");
  });
});

describe("summarizeHours", () => {
  it("returns the single range for uniform hours", () => {
    expect(summarizeHours(uniformRestaurant)).toBe("09:00–22:00");
  });

  it("returns a varies hint for custom hours without a day", () => {
    expect(summarizeHours(customRestaurant)).toBe("Varies by day");
  });

  it("returns the day's hours when a day is given", () => {
    expect(summarizeHours(customRestaurant, 7)).toBe("12:00–16:00 today");
  });
});

describe("isoDayShortName", () => {
  it("names each ISO day", () => {
    expect(isoDayShortName(1)).toBe("Mon");
    expect(isoDayShortName(7)).toBe("Sun");
  });

  it("returns an empty string for a day outside 1-7", () => {
    expect(isoDayShortName(0)).toBe("");
    expect(isoDayShortName(8)).toBe("");
  });
});

describe("getNextOpening", () => {
  const hours = {
    openTime: "09:00",
    closeTime: "22:00",
    openHours: [
      { day: 1, open: "09:00", close: "22:00" },
      { day: 5, open: "08:00", close: "23:00" },
    ],
  };

  it("finds the next open day after the given one", () => {
    expect(getNextOpening(hours, 4, [1, 5])).toEqual({ isoDay: 5, open: "08:00" });
  });

  it("wraps around the week rather than stopping at Sunday", () => {
    expect(getNextOpening(hours, 6, [1, 5])).toEqual({ isoDay: 1, open: "09:00" });
  });

  it("skips the day it starts from, so a weekly-only opening points at next week", () => {
    expect(getNextOpening(hours, 5, [5])).toEqual({ isoDay: 5, open: "08:00" });
  });

  it("returns null when the location never opens", () => {
    expect(getNextOpening(hours, 3, [])).toBeNull();
  });

  it("falls back to the uniform hours for a day with no per-day entry", () => {
    expect(getNextOpening(hours, 1, [3])).toEqual({ isoDay: 3, open: "09:00" });
  });
});
