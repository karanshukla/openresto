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
