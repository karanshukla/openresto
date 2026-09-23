import { hasDuplicateTurnTimes, turnTimeRanges } from "@/utils/turnTimes";

describe("turnTimeRanges", () => {
  it("stops each rule one seat below the next", () => {
    expect(
      turnTimeRanges([
        { minSeats: 3, minutes: 90 },
        { minSeats: 1, minutes: 60 },
        { minSeats: 5, minutes: 120 },
      ])
    ).toEqual([
      { minSeats: 1, maxSeats: 2, minutes: 60 },
      { minSeats: 3, maxSeats: 4, minutes: 90 },
      { minSeats: 5, maxSeats: null, minutes: 120 },
    ]);
  });

  it("leaves the largest rule open-ended", () => {
    expect(turnTimeRanges([{ minSeats: 6, minutes: 150 }])).toEqual([
      { minSeats: 6, maxSeats: null, minutes: 150 },
    ]);
  });
});

describe("hasDuplicateTurnTimes", () => {
  it("is true when two rules start at the same party size", () => {
    expect(
      hasDuplicateTurnTimes([
        { minSeats: 3, minutes: 90 },
        { minSeats: 3, minutes: 120 },
      ])
    ).toBe(true);
  });

  it("is false when every rule starts at its own party size", () => {
    expect(
      hasDuplicateTurnTimes([
        { minSeats: 3, minutes: 90 },
        { minSeats: 4, minutes: 120 },
      ])
    ).toBe(false);
  });
});
