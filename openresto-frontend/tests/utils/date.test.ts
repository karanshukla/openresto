import {
  convertLocalToUtc,
  isTodayInTimezone,
  getNowInTimezone,
  formatCurrentTimeInTimezone,
} from "@/utils/date";

describe("date utility - convertLocalToUtc", () => {
  it("converts Toronto local time (EDT, UTC-4) to UTC", () => {
    // 3:00 PM local in Toronto on April 18 (Daylight Savings)
    const result = convertLocalToUtc("2026-04-18", "15:00", "America/Toronto");
    // Expected: 19:00 UTC
    expect(result).toBe("2026-04-18T19:00:00.000Z");
  });

  it("converts London local time (BST, UTC+1) to UTC", () => {
    // 3:00 PM local in London on April 18 (Daylight Savings)
    const result = convertLocalToUtc("2026-04-18", "15:00", "Europe/London");
    // Expected: 14:00 UTC
    expect(result).toBe("2026-04-18T14:00:00.000Z");
  });

  it("converts Sydney local time (AEST, UTC+10) to UTC", () => {
    // 3:00 PM local in Sydney on April 18
    const result = convertLocalToUtc("2026-04-18", "15:00", "Australia/Sydney");
    // Expected: 05:00 UTC
    expect(result).toBe("2026-04-18T05:00:00.000Z");
  });

  it("converts Tokyo local time (JST, UTC+9) to UTC", () => {
    // 3:00 PM local in Tokyo on April 18
    const result = convertLocalToUtc("2026-04-18", "15:00", "Asia/Tokyo");
    // Expected: 06:00 UTC
    expect(result).toBe("2026-04-18T06:00:00.000Z");
  });

  it("defaults to UTC if timezone is invalid", () => {
    const result = convertLocalToUtc("2026-04-18", "15:00", "Invalid/Timezone");
    // Standard JS Date parsing will treat this as local,
    // but the utility tries to fallback safely.
    // In Jest environment, default local might be UTC.
    const expected = new Date("2026-04-18T15:00:00").toISOString();
    expect(result).toBe(expected);
  });

  it("uses UTC when timezone is empty string", () => {
    const result = convertLocalToUtc("2026-04-18", "15:00", "");
    expect(typeof result).toBe("string");
    expect(result).toContain("2026-04-18");
  });
});

describe("date utility - getNowInTimezone", () => {
  it("returns valid date and time components for UTC", () => {
    const result = getNowInTimezone("UTC");
    expect(result.dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.hours).toBeGreaterThanOrEqual(0);
    expect(result.hours).toBeLessThanOrEqual(23);
    expect(result.minutes).toBeGreaterThanOrEqual(0);
    expect(result.minutes).toBeLessThanOrEqual(59);
  });

  it("returns valid date and time for a named timezone", () => {
    const result = getNowInTimezone("America/New_York");
    expect(result.dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.hours).toBeGreaterThanOrEqual(0);
    expect(result.hours).toBeLessThanOrEqual(23);
  });

  it("uses UTC when timezone is empty string", () => {
    const result = getNowInTimezone("");
    expect(result.dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("falls back gracefully for invalid timezone", () => {
    const result = getNowInTimezone("Invalid/Timezone");
    expect(result).toHaveProperty("dateStr");
    expect(result).toHaveProperty("hours");
    expect(result).toHaveProperty("minutes");
  });

  it("treats hour 24 as 0 (midnight guard)", () => {
    const origDateTimeFormat = Intl.DateTimeFormat;
    const mockFormatToParts = jest.fn(() => [
      { type: "year", value: "2026" },
      { type: "month", value: "06" },
      { type: "day", value: "05" },
      { type: "hour", value: "24" },
      { type: "minute", value: "00" },
    ]);
    // @ts-ignore
    global.Intl.DateTimeFormat = jest.fn(() => ({ formatToParts: mockFormatToParts }));
    const result = getNowInTimezone("UTC");
    expect(result.hours).toBe(0);
    // @ts-ignore
    global.Intl.DateTimeFormat = origDateTimeFormat;
  });

  it("falls back to '00' when a format part type is missing", () => {
    const origDateTimeFormat = Intl.DateTimeFormat;
    const mockFormatToParts = jest.fn(() => [
      { type: "year", value: "2026" },
      { type: "month", value: "06" },
      { type: "day", value: "05" },
      { type: "hour", value: "10" },
      // "minute" is intentionally absent to trigger the ?? "00" fallback
    ]);
    // @ts-ignore
    global.Intl.DateTimeFormat = jest.fn(() => ({ formatToParts: mockFormatToParts }));
    const result = getNowInTimezone("UTC");
    expect(result.minutes).toBe(0);
    // @ts-ignore
    global.Intl.DateTimeFormat = origDateTimeFormat;
  });
});

describe("date utility - formatCurrentTimeInTimezone", () => {
  it("returns a formatted time string for UTC", () => {
    const result = formatCurrentTimeInTimezone("UTC");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns formatted time for a named timezone", () => {
    const result = formatCurrentTimeInTimezone("America/Chicago");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("uses UTC when timezone is empty string", () => {
    const result = formatCurrentTimeInTimezone("");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("falls back gracefully for invalid timezone", () => {
    const result = formatCurrentTimeInTimezone("Invalid/Timezone");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("date utility - isTodayInTimezone", () => {
  it("returns true for now in UTC", () => {
    const now = new Date().toISOString();
    expect(isTodayInTimezone(now, "UTC")).toBe(true);
  });

  it("returns true for now in specific timezone", () => {
    const now = new Date().toISOString();
    expect(isTodayInTimezone(now, "America/Toronto")).toBe(true);
  });

  it("returns false for yesterday", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isTodayInTimezone(yesterday.toISOString(), "UTC")).toBe(false);
  });

  it("returns false for tomorrow", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(isTodayInTimezone(tomorrow.toISOString(), "UTC")).toBe(false);
  });

  it("returns false for invalid date string", () => {
    expect(isTodayInTimezone("not-a-date", "UTC")).toBe(false);
  });

  it("returns false when timezone is invalid and throws", () => {
    expect(isTodayInTimezone(new Date().toISOString(), "Invalid/Timezone")).toBe(false);
  });

  it("uses UTC when timezone is empty string", () => {
    const now = new Date().toISOString();
    const result = isTodayInTimezone(now, "");
    expect(typeof result).toBe("boolean");
  });
});
