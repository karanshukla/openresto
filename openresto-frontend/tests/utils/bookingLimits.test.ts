import {
  clampPartySize,
  DEFAULT_PICKER_DAYS_AHEAD,
  isPartyAboveOnlineMax,
  isPartyBelowOnlineMin,
  minOnlinePartySize,
  partySizeOptions,
  pickerDaysAhead,
} from "@/utils/bookingLimits";

describe("pickerDaysAhead", () => {
  it("is the picker's own month without a horizon", () => {
    expect(pickerDaysAhead({})).toBe(DEFAULT_PICKER_DAYS_AHEAD);
    expect(pickerDaysAhead({ maxBookingDaysAhead: null })).toBe(DEFAULT_PICKER_DAYS_AHEAD);
  });

  it("follows the horizon whether it is shorter or longer than the month", () => {
    expect(pickerDaysAhead({ maxBookingDaysAhead: 7 })).toBe(7);
    expect(pickerDaysAhead({ maxBookingDaysAhead: 90 })).toBe(90);
  });

  it("leaves today only for a horizon of zero", () => {
    expect(pickerDaysAhead({ maxBookingDaysAhead: 0 })).toBe(0);
  });
});

describe("partySizeOptions", () => {
  it("lists one to ten without limits", () => {
    expect(partySizeOptions({})).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("runs from the minimum to one past the maximum, so a bigger party can say so", () => {
    expect(partySizeOptions({ minOnlinePartySize: 2, maxOnlinePartySize: 6 })).toEqual([
      2, 3, 4, 5, 6, 7,
    ]);
  });

  it("still reaches ten when only a minimum is set", () => {
    expect(partySizeOptions({ minOnlinePartySize: 4 })).toEqual([4, 5, 6, 7, 8, 9, 10]);
  });

  it("starts at a minimum above ten rather than offering nothing", () => {
    expect(partySizeOptions({ minOnlinePartySize: 12 })).toEqual([12]);
  });
});

describe("party size bounds", () => {
  const r = { minOnlinePartySize: 2, maxOnlinePartySize: 6 };

  it("reads the minimum as one when unset", () => {
    expect(minOnlinePartySize({})).toBe(1);
    expect(minOnlinePartySize(r)).toBe(2);
  });

  it("flags a party over the maximum and not one at it", () => {
    expect(isPartyAboveOnlineMax(r, 7)).toBe(true);
    expect(isPartyAboveOnlineMax(r, 6)).toBe(false);
    expect(isPartyAboveOnlineMax({}, 40)).toBe(false);
  });

  it("flags a party under the minimum and not one at it", () => {
    expect(isPartyBelowOnlineMin(r, 1)).toBe(true);
    expect(isPartyBelowOnlineMin(r, 2)).toBe(false);
    expect(isPartyBelowOnlineMin({}, 1)).toBe(false);
  });

  it("clamps a default into the online range and leaves one inside it alone", () => {
    expect(clampPartySize(r, 1)).toBe(2);
    expect(clampPartySize(r, 9)).toBe(6);
    expect(clampPartySize(r, 4)).toBe(4);
    expect(clampPartySize({}, 9)).toBe(9);
  });
});
