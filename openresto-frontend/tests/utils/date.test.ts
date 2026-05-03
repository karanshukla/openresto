import { convertLocalToUtc, isTodayInTimezone } from "@/utils/date";

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
});
