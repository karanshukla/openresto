import {
  groupDisplayName,
  groupDropdownLabel,
  groupedTableIds,
  TableGroupLike,
} from "@/utils/tableGroups";

const named: TableGroupLike = {
  name: "Window booths",
  combinedSeats: 5,
  members: [
    { id: 1, name: "T1" },
    { id: 2, name: "T2" },
  ],
};

const unnamed: TableGroupLike = {
  combinedSeats: 4,
  members: [
    { id: 4, name: "B1" },
    { id: 5, name: "B2" },
  ],
};

describe("groupDisplayName", () => {
  it("uses the admin-assigned name when present, with no capacity suffix", () => {
    expect(groupDisplayName(named)).toBe("Window booths");
  });

  it("falls back to the member table names", () => {
    expect(groupDisplayName(unnamed)).toBe("Tables B1 + B2");
  });

  it("falls back to the table id for an unnamed member table", () => {
    expect(
      groupDisplayName({ combinedSeats: 4, members: [{ id: 7 }, { id: 8, name: "B2" }] })
    ).toBe("Tables 7 + B2");
  });
});

describe("groupDropdownLabel", () => {
  it("appends the capacity to a named group", () => {
    expect(groupDropdownLabel(named)).toBe("Window booths (5 seats)");
  });

  it("spells out the members for an unnamed group", () => {
    expect(groupDropdownLabel(unnamed)).toBe("Tables B1 + B2 (4 seats combined)");
  });
});

describe("groupedTableIds", () => {
  it("collects every member id across groups", () => {
    expect(groupedTableIds([named, unnamed])).toEqual(new Set([1, 2, 4, 5]));
  });

  it("returns an empty set when there are no groups", () => {
    expect(groupedTableIds([])).toEqual(new Set());
  });

  it("de-duplicates ids", () => {
    expect(groupedTableIds([named, named])).toEqual(new Set([1, 2]));
  });
});
