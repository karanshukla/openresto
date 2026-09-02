import {
  secondsUntilExpiry,
  isHoldExpired,
  secondsUntilExpiryNotice,
  HOLD_EXPIRY_NOTICE_LEAD_SECONDS,
} from "@/components/booking/holdCountdown";

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

describe("secondsUntilExpiryNotice", () => {
  const now = Date.parse("2026-06-15T19:00:00.000Z");
  const at = (secondsFromNow: number) => new Date(now + secondsFromNow * 1000).toISOString();

  it("waits the whole hold minus the lead", () => {
    expect(secondsUntilExpiryNotice(at(300), now)).toBe(300 - HOLD_EXPIRY_NOTICE_LEAD_SECONDS);
  });

  // Either side of the boundary: a hold one second longer than the lead still leaves a
  // moment to warn in, one exactly the length of the lead does not.
  it("warns about a hold one second longer than the lead", () => {
    expect(secondsUntilExpiryNotice(at(HOLD_EXPIRY_NOTICE_LEAD_SECONDS + 1), now)).toBe(1);
  });

  it("declines to warn about a hold exactly as long as the lead", () => {
    expect(secondsUntilExpiryNotice(at(HOLD_EXPIRY_NOTICE_LEAD_SECONDS), now)).toBeNull();
  });

  it("declines to warn about a hold that has already expired", () => {
    expect(secondsUntilExpiryNotice(at(-30), now)).toBeNull();
  });
});
