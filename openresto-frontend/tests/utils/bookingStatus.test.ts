import { isPast } from "@/utils/bookingStatus";

describe("isPast", () => {
  it("returns false for a booking more than 5 minutes in the future", () => {
    const date = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    expect(isPast(date)).toBe(false);
  });

  it("returns false for a booking within the 5-minute grace period", () => {
    const date = new Date(Date.now() - 4 * 60 * 1000).toISOString();
    expect(isPast(date)).toBe(false);
  });

  it("returns true for a booking just outside the 5-minute grace period", () => {
    const date = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    expect(isPast(date)).toBe(true);
  });

  it("returns true for a booking well in the past", () => {
    const date = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(isPast(date)).toBe(true);
  });
});
