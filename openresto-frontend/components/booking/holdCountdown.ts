// Pure helpers for the table-hold countdown. Extracted from useTableHold so the
// seconds-remaining math is unit-testable without React or fake timers.

// Seconds remaining until expiry, floored at 0. `now` defaults to Date.now() but
// is injectable for deterministic tests.
export function secondsUntilExpiry(expiresAt: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
}

// True when the hold has reached (or passed) zero seconds remaining.
export function isHoldExpired(secondsLeft: number): boolean {
  return secondsLeft <= 0;
}

// How long before a hold expires the guest is warned that it is about to go.
export const HOLD_EXPIRY_NOTICE_LEAD_SECONDS = 60;

// Seconds to wait before the "one more minute" warning should fire, or null when the hold
// expires too soon for the warning to land ahead of it — a warning that arrives with the table
// already released tells the guest nothing they can act on.
export function secondsUntilExpiryNotice(
  expiresAt: string,
  now: number = Date.now()
): number | null {
  const delay = secondsUntilExpiry(expiresAt, now) - HOLD_EXPIRY_NOTICE_LEAD_SECONDS;
  return delay > 0 ? delay : null;
}
