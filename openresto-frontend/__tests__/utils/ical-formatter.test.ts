import { fmtCal } from "@/utils/calendar";

describe("fmtCal", () => {
  it("formats UTC dates in iCal format", () => {
    const d = new Date(Date.UTC(2026, 2, 28, 19, 55, 0));
    expect(fmtCal(d)).toBe("20260328T195500Z");
  });

  it("handles midnight UTC", () => {
    expect(fmtCal(new Date(Date.UTC(2026, 0, 1, 0, 0, 0)))).toBe("20260101T000000Z");
  });

  it("handles end of year", () => {
    expect(fmtCal(new Date(Date.UTC(2026, 11, 31, 23, 59, 59)))).toBe("20261231T235959Z");
  });

  it("pads single-digit months, days, hours, minutes, seconds", () => {
    expect(fmtCal(new Date(Date.UTC(2026, 1, 3, 5, 5, 5)))).toBe("20260203T050505Z");
  });

  it("always includes Z suffix", () => {
    [
      new Date(Date.UTC(2026, 0, 15, 10, 30, 0)),
      new Date(Date.UTC(2026, 5, 20, 14, 45, 30)),
      new Date(Date.UTC(2026, 11, 25, 8, 15, 45)),
    ].forEach((d) => {
      expect(fmtCal(d)).toMatch(/Z$/);
    });
  });

  it("is consistent regardless of how the Date was constructed", () => {
    const ts = Date.UTC(2026, 5, 15, 12, 0, 0);
    expect(fmtCal(new Date(ts))).toBe(fmtCal(new Date("2026-06-15T12:00:00.000Z")));
    expect(fmtCal(new Date(ts))).toBe("20260615T120000Z");
  });

  it("handles leap years", () => {
    expect(fmtCal(new Date(Date.UTC(2024, 1, 29, 12, 0, 0)))).toBe("20240229T120000Z");
  });

  it("produces exactly 16 characters", () => {
    const result = fmtCal(new Date(Date.UTC(2026, 8, 15, 14, 30, 45)));
    expect(result).toMatch(/^\d{8}T\d{6}Z$/);
    expect(result.length).toBe(16);
  });

  it("ignores milliseconds", () => {
    const result = fmtCal(new Date(Date.UTC(2026, 5, 15, 12, 30, 45, 999)));
    expect(result).toBe("20260615T123045Z");
    expect(result).not.toContain(".999");
  });

  it("handles epoch", () => {
    expect(fmtCal(new Date(Date.UTC(1970, 0, 1, 0, 0, 0)))).toBe("19700101T000000Z");
  });

  it("handles far future dates", () => {
    expect(fmtCal(new Date(Date.UTC(2100, 11, 31, 23, 59, 59)))).toBe("21001231T235959Z");
  });

  it("handles typical booking times", () => {
    const cases = [
      { h: 18, m: 0, expected: "180000" },
      { h: 19, m: 30, expected: "193000" },
      { h: 20, m: 15, expected: "201500" },
      { h: 21, m: 0, expected: "210000" },
    ];
    cases.forEach(({ h, m, expected }) => {
      const result = fmtCal(new Date(Date.UTC(2026, 5, 15, h, m, 0)));
      expect(result).toContain(expected);
    });
  });

  it("computes 1-hour end time correctly", () => {
    const start = new Date(Date.UTC(2026, 5, 15, 19, 30, 0));
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    expect(fmtCal(start)).toBe("20260615T193000Z");
    expect(fmtCal(end)).toBe("20260615T203000Z");
  });
});
