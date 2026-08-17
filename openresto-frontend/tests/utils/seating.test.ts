import { canSeat, seatsAtLeast } from "@/utils/seating";

describe("canSeat", () => {
  // The pair is the point: the cap is a boundary, and only testing one side of it lets the
  // client drift off the server's rule without anything failing.
  it("accepts a unit exactly at the oversize cap", () => {
    expect(canSeat(6, 4, 2)).toBe(true);
  });

  it("rejects a unit one seat over the cap", () => {
    expect(canSeat(7, 4, 2)).toBe(false);
  });

  it("rejects a unit smaller than the party", () => {
    expect(canSeat(2, 4, null)).toBe(false);
  });

  it("accepts a unit of any size when no cap is set", () => {
    expect(canSeat(10, 2, null)).toBe(true);
    expect(canSeat(10, 2, undefined)).toBe(true);
  });

  it("accepts an exact fit under a cap of zero", () => {
    expect(canSeat(4, 4, 0)).toBe(true);
    expect(canSeat(5, 4, 0)).toBe(false);
  });
});

describe("seatsAtLeast", () => {
  const tables = [
    { id: 1, seats: 2 },
    { id: 2, seats: 4 },
    { id: 3, seats: 6 },
    { id: 4, seats: 8 },
  ];

  it("keeps only the units the party fits into, within the cap", () => {
    const eligible = seatsAtLeast(tables, 4, 2, (t) => t.seats);
    expect(eligible.map((t) => t.id)).toEqual([2, 3]);
  });

  it("keeps every large-enough unit when no cap is set", () => {
    const eligible = seatsAtLeast(tables, 4, null, (t) => t.seats);
    expect(eligible.map((t) => t.id)).toEqual([2, 3, 4]);
  });
});
