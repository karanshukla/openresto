import type { TurnTimeDto } from "@/api/restaurants";

export interface TurnTimeRange {
  minSeats: number;
  /** The largest party the rule covers, or null when it covers every larger party. */
  maxSeats: number | null;
  minutes: number;
}

/**
 * Which party sizes each rule covers, mirroring `BookingDuration.For` on the server: a party gets
 * the rule with the largest `minSeats` at or below its size, so a rule runs up to one below the
 * next. For display only; the server resolves the length a booking actually gets.
 *
 * @see [turnTimes.test.ts](../tests/utils/turnTimes.test.ts) — pins that a rule stops one seat
 * below the next and that the largest rule is open-ended.
 */
export function turnTimeRanges(rules: TurnTimeDto[]): TurnTimeRange[] {
  const sorted = [...rules].sort((a, b) => a.minSeats - b.minSeats);
  return sorted.map((rule, i) => ({
    minSeats: rule.minSeats,
    maxSeats: i + 1 < sorted.length ? sorted[i + 1].minSeats - 1 : null,
    minutes: rule.minutes,
  }));
}

/** True when two rules start at the same party size, which the server rejects. */
export function hasDuplicateTurnTimes(rules: TurnTimeDto[]): boolean {
  return new Set(rules.map((r) => r.minSeats)).size !== rules.length;
}
