import {
  parseWalkInDays,
  isWalkInOnlyOnDay,
  isWalkInOnlyOnDate,
  walkInDaysLabel,
  walkInBadgeLabel,
} from "@/utils/walkIn";

describe("parseWalkInDays", () => {
  it("returns empty array for null/undefined/empty", () => {
    expect(parseWalkInDays(undefined)).toEqual([]);
    expect(parseWalkInDays(null)).toEqual([]);
    expect(parseWalkInDays("")).toEqual([]);
  });

  it("parses comma-separated ISO days and ignores junk", () => {
    expect(parseWalkInDays("6,7")).toEqual([6, 7]);
    expect(parseWalkInDays(" 1 , 8, 0, abc, 3 ")).toEqual([1, 3]);
  });
});

describe("isWalkInOnlyOnDay", () => {
  it("is true for every day when walkInOnly is set", () => {
    expect(isWalkInOnlyOnDay({ walkInOnly: true }, 3)).toBe(true);
  });

  it("matches only listed days otherwise", () => {
    const r = { walkInDays: "6,7" };
    expect(isWalkInOnlyOnDay(r, 6)).toBe(true);
    expect(isWalkInOnlyOnDay(r, 7)).toBe(true);
    expect(isWalkInOnlyOnDay(r, 1)).toBe(false);
  });

  it("is false when nothing is configured", () => {
    expect(isWalkInOnlyOnDay({}, 6)).toBe(false);
  });
});

describe("isWalkInOnlyOnDate", () => {
  it("resolves the ISO day from a YYYY-MM-DD date", () => {
    // 2026-06-20 is a Saturday (ISO 6), 2026-06-21 a Sunday (ISO 7)
    const r = { walkInDays: "6" };
    expect(isWalkInOnlyOnDate(r, "2026-06-20")).toBe(true);
    expect(isWalkInOnlyOnDate(r, "2026-06-21")).toBe(false);
  });
});

describe("walkInDaysLabel", () => {
  it("returns null when no days are set", () => {
    expect(walkInDaysLabel({})).toBeNull();
    expect(walkInDaysLabel({ walkInDays: "" })).toBeNull();
  });

  it("names a single day", () => {
    expect(walkInDaysLabel({ walkInDays: "7" })).toBe("Sundays");
  });

  it("joins multiple days with 'and'", () => {
    expect(walkInDaysLabel({ walkInDays: "6,7" })).toBe("Saturdays and Sundays");
    expect(walkInDaysLabel({ walkInDays: "1,3,5" })).toBe("Mondays, Wednesdays and Fridays");
  });

  it("sorts and deduplicates", () => {
    expect(walkInDaysLabel({ walkInDays: "7,6,6" })).toBe("Saturdays and Sundays");
  });
});

describe("walkInBadgeLabel", () => {
  it("returns null when no walk-in policy is configured", () => {
    expect(walkInBadgeLabel({})).toBeNull();
  });

  it("returns a plain label for a fully walk-in location", () => {
    expect(walkInBadgeLabel({ walkInOnly: true })).toBe("Walk-ins only");
  });

  it("ignores walkInDays for a fully walk-in location", () => {
    expect(walkInBadgeLabel({ walkInOnly: true, walkInDays: "6,7" })).toBe("Walk-ins only");
  });

  it("names the specific walk-in days for a conditional location", () => {
    expect(walkInBadgeLabel({ walkInDays: "5" })).toBe("Walk-ins on Fridays");
    expect(walkInBadgeLabel({ walkInDays: "6,7" })).toBe("Walk-ins on Saturdays and Sundays");
  });
});
