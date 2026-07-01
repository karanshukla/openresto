import {
  getHoursForDay,
  getHoursForDate,
  getIsoDayFromDateString,
  hasCustomHours,
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
