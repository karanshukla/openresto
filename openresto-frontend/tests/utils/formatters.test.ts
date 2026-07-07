import { fmtDate, isoDate, initials } from "@/utils/formatters";

describe("formatters - fmtDate", () => {
  it("formats a date with the toLocaleDateString short weekday/month/day shape", () => {
    const d = new Date(2026, 3, 18, 12, 0, 0); // Saturday, April 18, 2026
    // toLocaleDateString with these options returns e.g. "Sat, Apr 18" in en locales.
    // We assert day-of-month and abbreviated month are present; year is intentionally omitted
    // by the formatter (matching the original inline behaviour).
    const result = fmtDate(d);
    expect(result).toContain("18");
    expect(result).toMatch(/apr/i);
  });
});

describe("formatters - isoDate", () => {
  it("formats a Date as a naive YYYY-MM-DD string", () => {
    const d = new Date(2026, 3, 18, 23, 59, 59); // local Apr 18
    expect(isoDate(d)).toBe("2026-04-18");
  });

  it("pads single-digit months and days", () => {
    const d = new Date(2026, 0, 5, 0, 0, 0); // local Jan 5
    expect(isoDate(d)).toBe("2026-01-05");
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
