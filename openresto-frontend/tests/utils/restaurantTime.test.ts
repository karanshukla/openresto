import {
  getRestaurantNow,
  getRestaurantDate,
  parseDayOfWeek,
  getOpenDaysList,
} from "@/utils/restaurantTime";

describe("restaurantTime", () => {
  describe("getRestaurantNow", () => {
    it("returns total minutes within range and an ISO day 1-7 for a valid timezone", () => {
      // Pin clock so the result is deterministic. 2026-01-05 is a Monday.
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-01-05T10:30:00Z"));
      try {
        const { totalMins, isoDay } = getRestaurantNow("UTC");
        expect(isoDay).toBe(1); // Monday
        expect(totalMins).toBe(10 * 60 + 30);
      } finally {
        jest.useRealTimers();
      }
    });

    it("falls back to local time + ISO day when the timezone is invalid", () => {
      const { isoDay } = getRestaurantNow("Invalid/Zone_XYZ");
      expect(isoDay).toBeGreaterThanOrEqual(1);
      expect(isoDay).toBeLessThanOrEqual(7);
    });
  });

  describe("getRestaurantDate", () => {
    it("returns a YYYY-MM-DD string for a valid timezone", () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-01-05T10:30:00Z"));
      try {
        expect(getRestaurantDate("UTC")).toBe("2026-01-05");
      } finally {
        jest.useRealTimers();
      }
    });

    it("falls back gracefully for an invalid timezone", () => {
      const d = getRestaurantDate("Invalid/Zone_XYZ");
      expect(/^\d{4}-\d{2}-\d{2}$/.test(d)).toBe(true);
    });
  });

  describe("parseDayOfWeek", () => {
    it("parses ISO numeric strings", () => {
      expect(parseDayOfWeek("1")).toBe(1);
      expect(parseDayOfWeek("7")).toBe(7);
    });

    it("parses weekday name prefixes", () => {
      expect(parseDayOfWeek("Mon")).toBe(1);
      expect(parseDayOfWeek("Wednesday")).toBe(3);
      expect(parseDayOfWeek("sunday")).toBe(7);
    });

    it("returns 0 for unparseable input", () => {
      expect(parseDayOfWeek("xyz")).toBe(0);
      expect(parseDayOfWeek("9")).toBe(0);
    });
  });

  describe("getOpenDaysList", () => {
    it("parses a comma-separated list of ISO day numbers", () => {
      expect(getOpenDaysList({ openDays: "1,2,3,4,5" })).toEqual([1, 2, 3, 4, 5]);
    });

    it("parses weekday-name tokens", () => {
      expect(getOpenDaysList({ openDays: "Mon,Tue,Wed" })).toEqual([1, 2, 3]);
    });

    it("defaults to all seven days when openDays is missing/undefined", () => {
      // Mirrors the original RestaurantCard helper: a missing openDays (optional
      // chain → undefined) falls back to all seven days. An empty/whitespace
      // string parses to no valid days (the `??` only catches nullish, and the
      // filtered-empty array is a valid "open no days" result — distinct from
      // "field absent").
      expect(getOpenDaysList({ openDays: undefined as any })).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(getOpenDaysList({} as any)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it("filters out unparseable tokens", () => {
      expect(getOpenDaysList({ openDays: "1,xyz,3" })).toEqual([1, 3]);
    });
  });
});
