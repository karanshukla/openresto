import {
  fmtDate,
  fmtDateString,
  fmtDateTime,
  fmtDateTimeInZone,
  fmtLongDate,
  fmtMonthDay,
  fmtNumber,
  fmtTime,
  fmtTimestamp,
  fmtWeekday,
  fmtYear,
  initials,
  isoDate,
  relativeTime,
} from "@/utils/formatters";
import { setActiveLocale } from "@/utils/locale";

afterEach(() => {
  setActiveLocale(undefined);
});

describe("formatters - fmtDate", () => {
  it("formats a date with the short weekday/month/day shape under en-GB", () => {
    setActiveLocale("en-GB");
    const d = new Date(2026, 3, 18, 12, 0, 0); // Saturday, April 18, 2026
    const result = fmtDate(d);
    expect(result).toContain("18");
    expect(result).toMatch(/apr/i);
  });

  it("formats a date under fr", () => {
    setActiveLocale("fr");
    const d = new Date(2026, 3, 18, 12, 0, 0);
    const result = fmtDate(d);
    expect(result).toContain("18");
    expect(result.toLowerCase()).toContain("avr");
  });
});

describe("formatters - fmtDateString / isoDate", () => {
  it("formats a Date as a naive YYYY-MM-DD string", () => {
    const d = new Date(2026, 3, 18, 23, 59, 59); // local Apr 18
    expect(isoDate(d)).toBe("2026-04-18");
  });

  it("pads single-digit months and days", () => {
    const d = new Date(2026, 0, 5, 0, 0, 0); // local Jan 5
    expect(isoDate(d)).toBe("2026-01-05");
  });

  it("formats a YYYY-MM-DD string the same as the equivalent noon Date", () => {
    setActiveLocale("en-GB");
    expect(fmtDateString("2026-04-18")).toBe(fmtDate(new Date("2026-04-18T12:00:00")));
  });
});

describe("formatters - fmtTime", () => {
  it("includes the hour and minute", () => {
    setActiveLocale("en-GB");
    const d = new Date(2026, 3, 18, 19, 30, 0);
    expect(fmtTime(d)).toMatch(/19:30|7:30/);
  });

  it("formats under fr", () => {
    setActiveLocale("fr");
    const d = new Date(2026, 3, 18, 19, 30, 0);
    expect(fmtTime(d)).toContain("19");
    expect(fmtTime(d)).toContain("30");
  });
});

describe("formatters - fmtDateTime", () => {
  it("combines weekday, month, day and time", () => {
    setActiveLocale("en-GB");
    const d = new Date(2026, 3, 18, 19, 30, 0);
    const result = fmtDateTime(d);
    expect(result).toMatch(/apr/i);
    expect(result).toContain("18");
    expect(result).toMatch(/19:30|7:30/);
  });
});

describe("formatters - fmtDateTimeInZone", () => {
  it("renders the instant in the given IANA timezone rather than the active locale's default", () => {
    setActiveLocale("en-GB");
    // 2026-04-18T23:30:00Z is already the 19th in a zone ahead of UTC.
    const result = fmtDateTimeInZone("2026-04-18T23:30:00Z", "Pacific/Auckland");
    expect(result).toMatch(/19/);
  });
});

describe("formatters - fmtWeekday", () => {
  it("returns an abbreviated weekday", () => {
    setActiveLocale("en-GB");
    const d = new Date(2026, 3, 18); // Saturday
    expect(fmtWeekday(d)).toMatch(/sat/i);
  });
});

describe("formatters - fmtMonthDay", () => {
  it("returns month + day, no year", () => {
    setActiveLocale("en-GB");
    const d = new Date(2026, 3, 18);
    const result = fmtMonthDay(d);
    expect(result).toMatch(/apr/i);
    expect(result).toContain("18");
    expect(result).not.toContain("2026");
  });
});

describe("formatters - fmtLongDate", () => {
  it("returns a full weekday + long month + day + year", () => {
    setActiveLocale("en-GB");
    const d = new Date(2026, 3, 18);
    const result = fmtLongDate(d);
    expect(result).toMatch(/saturday/i);
    expect(result).toMatch(/april/i);
    expect(result).toContain("18");
    expect(result).toContain("2026");
  });
});

describe("formatters - fmtYear", () => {
  it("returns only the year", () => {
    setActiveLocale("en-GB");
    expect(fmtYear(new Date(2026, 3, 18))).toBe("2026");
  });
});

describe("formatters - fmtTimestamp", () => {
  it("includes both date and time", () => {
    setActiveLocale("en-GB");
    const result = fmtTimestamp("2026-04-18T19:30:00Z");
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("formatters - fmtNumber", () => {
  it("groups thousands under en-GB", () => {
    setActiveLocale("en-GB");
    expect(fmtNumber(12345)).toBe("12,345");
  });

  it("groups thousands under fr", () => {
    setActiveLocale("fr");
    // French grouping uses a non-breaking space; just assert the digits survive intact.
    expect(fmtNumber(12345).replace(/\s/g, "")).toBe("12345");
  });
});

/**
 * `relativeTime` passes `getActiveLocale()` to `Intl.RelativeTimeFormat`, and an unset
 * locale means "follow the device" — so an assertion left unpinned reads the host's
 * locale and only holds on a US-locale machine (`en-CA` renders "5 mins ago", `en-GB`
 * "5 min ago"). Pin the locale the app itself defaults to.
 */
describe("formatters - relativeTime", () => {
  beforeEach(() => {
    setActiveLocale("en");
  });

  it("returns 'now' for <1 minute", () => {
    const iso = new Date(Date.now() - 30_000).toISOString();
    expect(relativeTime(iso)).toBe("now");
  });

  it("returns minutes for <1 hour", () => {
    const iso = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(relativeTime(iso)).toBe("5m ago");
  });

  it("returns hours for <1 day", () => {
    const iso = new Date(Date.now() - 3 * 3_600_000).toISOString();
    expect(relativeTime(iso)).toBe("3h ago");
  });

  it("returns days for >=1 day", () => {
    const iso = new Date(Date.now() - 2 * 86_400_000).toISOString();
    expect(relativeTime(iso)).toBe("2d ago");
  });

  it("localizes under fr", () => {
    setActiveLocale("fr");
    const iso = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(relativeTime(iso)).toMatch(/min/);
  });
});

describe("formatters - initials", () => {
  it("returns first and last initials for a multi-word name", () => {
    expect(initials("John Doe")).toBe("JD");
  });

  it("returns the first two chars for a single-word name", () => {
    expect(initials("Admin")).toBe("AD");
  });

  it("strips separators from the local part of an email before initialising", () => {
    expect(initials("john.doe@example.com")).toBe("JD");
    expect(initials("john_doe-smith@example.com")).toBe("JS");
  });

  it("uppercases the result", () => {
    expect(initials("john doe")).toBe("JD");
  });
});
