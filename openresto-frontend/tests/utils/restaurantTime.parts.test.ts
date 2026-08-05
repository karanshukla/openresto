/**
 * The `?? fallback` on every `parts.find(...)` lookup is unreachable through a real
 * `Intl.DateTimeFormat` — it only fires if the runtime omits a part we asked for. Those defaults
 * are the difference between a sane badge and `NaN:NaN` on an engine with a partial ICU build
 * (the trimmed ICU shipped in some Android/Hermes builds is exactly that case), so they're
 * exercised here against a stubbed formatter.
 */
import { getRestaurantNow, getRestaurantDate, parseDayOfWeek } from "@/utils/restaurantTime";

type Part = { type: string; value: string };

const realDateTimeFormat = Intl.DateTimeFormat;

function stubFormatToParts(parts: Part[]) {
  jest
    .spyOn(Intl, "DateTimeFormat")
    .mockImplementation(() => ({ formatToParts: () => parts }) as unknown as Intl.DateTimeFormat);
}

afterEach(() => {
  jest.restoreAllMocks();
  Intl.DateTimeFormat = realDateTimeFormat;
});

describe("getRestaurantNow with an incomplete formatter result", () => {
  it("defaults the hour and minute to 0 when neither part is returned", () => {
    stubFormatToParts([{ type: "weekday", value: "Wednesday" }]);
    expect(getRestaurantNow("UTC")).toEqual({ totalMins: 0, isoDay: 3 });
  });

  it("defaults the weekday to Monday when the part is missing", () => {
    stubFormatToParts([
      { type: "hour", value: "09" },
      { type: "minute", value: "30" },
    ]);
    expect(getRestaurantNow("UTC")).toEqual({ totalMins: 570, isoDay: 1 });
  });

  it("falls back to ISO day 1 for an unrecognised weekday name", () => {
    // A non-English locale leaking through would otherwise index the map to undefined.
    stubFormatToParts([
      { type: "hour", value: "09" },
      { type: "minute", value: "30" },
      { type: "weekday", value: "Mittwoch" },
    ]);
    expect(getRestaurantNow("UTC")).toEqual({ totalMins: 570, isoDay: 1 });
  });

  it("normalises hour 24 to 0", () => {
    // hour12:false yields "24" for midnight on some ICU versions; the % 24 keeps it in range.
    stubFormatToParts([
      { type: "hour", value: "24" },
      { type: "minute", value: "15" },
      { type: "weekday", value: "Sunday" },
    ]);
    expect(getRestaurantNow("UTC")).toEqual({ totalMins: 15, isoDay: 7 });
  });
});

describe("getRestaurantNow timezone fallback", () => {
  it("maps a local Sunday to ISO day 7", () => {
    // getDay() returns 0 for Sunday; the ISO scheme this codebase uses puts Sunday last.
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 9, 14, 25)); // 2026-08-09 is a Sunday

    expect(getRestaurantNow("Not/AZone")).toEqual({ totalMins: 14 * 60 + 25, isoDay: 7 });

    jest.useRealTimers();
  });

  it("maps a local weekday straight through", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 5, 8, 5)); // 2026-08-05 is a Wednesday

    expect(getRestaurantNow("Not/AZone")).toEqual({ totalMins: 8 * 60 + 5, isoDay: 3 });

    jest.useRealTimers();
  });
});

describe("parseDayOfWeek weekday prefixes", () => {
  it.each([
    ["monday", 1],
    ["tues", 2],
    ["wednesday", 3],
    ["thur", 4],
    ["friday", 5],
    ["saturday", 6],
    ["sunday", 7],
  ])("parses %s to ISO day %i", (token, expected) => {
    expect(parseDayOfWeek(token)).toBe(expected);
    expect(parseDayOfWeek(token.toUpperCase())).toBe(expected);
  });
});

describe("getRestaurantDate with an incomplete formatter result", () => {
  it("returns empty segments rather than throwing when parts are missing", () => {
    stubFormatToParts([{ type: "year", value: "2026" }]);
    expect(getRestaurantDate("UTC")).toBe("2026--");
  });

  it("joins the parts it does receive", () => {
    stubFormatToParts([
      { type: "year", value: "2026" },
      { type: "month", value: "08" },
      { type: "day", value: "05" },
    ]);
    expect(getRestaurantDate("UTC")).toBe("2026-08-05");
  });
});
