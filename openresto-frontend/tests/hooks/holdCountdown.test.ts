import { secondsUntilExpiry, isHoldExpired } from "@/components/booking/holdCountdown";

describe("secondsUntilExpiry", () => {
  it("returns the whole seconds remaining for a future expiry", () => {
    const now = 1_000_000;
    const expiresAt = new Date(now + 120_000).toISOString(); // 120s in the future
    expect(secondsUntilExpiry(expiresAt, now)).toBe(120);
  });

  it("floors sub-second remainders down", () => {
    const now = 1_000_000;
    const expiresAt = new Date(now + 2_999).toISOString(); // 2.999s
    expect(secondsUntilExpiry(expiresAt, now)).toBe(2);
  });

  it("returns 0 for an expiry already in the past", () => {
    const now = 1_000_000;
    const expiresAt = new Date(now - 5_000).toISOString(); // 5s ago
    expect(secondsUntilExpiry(expiresAt, now)).toBe(0);
  });

  it("returns 0 exactly at the expiry instant (boundary)", () => {
    const now = 1_000_000;
    const expiresAt = new Date(now).toISOString();
    expect(secondsUntilExpiry(expiresAt, now)).toBe(0);
  });

  it("defaults `now` to Date.now() when omitted", () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    // Should be ~60, allow a little wall-clock slack
    const result = secondsUntilExpiry(expiresAt);
    expect(result).toBeGreaterThan(55);
    expect(result).toBeLessThanOrEqual(60);
  });
});

describe("isHoldExpired", () => {
  it("is false while seconds remain", () => {
    expect(isHoldExpired(1)).toBe(false);
    expect(isHoldExpired(120)).toBe(false);
  });

  it("is true at zero", () => {
    expect(isHoldExpired(0)).toBe(true);
  });

  it("is true for negative values (defensive)", () => {
    expect(isHoldExpired(-1)).toBe(true);
  });
});
