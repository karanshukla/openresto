import { getIsoDayFromDateString } from "@/utils/openingHours";

/**
 * Shared helpers for the walk-in-only policy. A location is walk-in only
 * either globally (`walkInOnly`) or on specific ISO days listed in
 * `walkInDays` (1=Monday … 7=Sunday, comma-separated). Walk-in-only means
 * the location stays listed publicly but the booking flow is disabled.
 */

export interface WalkInSource {
  walkInOnly?: boolean;
  walkInDays?: string | null;
}

const DAY_NAMES = [
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
  "Sundays",
];

export function parseWalkInDays(walkInDays?: string | null): number[] {
  if (!walkInDays) return [];
  return walkInDays
    .split(",")
    .map((d) => parseInt(d.trim(), 10))
    .filter((d) => d >= 1 && d <= 7);
}

/** True when the location takes no online bookings on the given ISO day. */
export function isWalkInOnlyOnDay(restaurant: WalkInSource, isoDay: number): boolean {
  if (restaurant.walkInOnly) return true;
  return parseWalkInDays(restaurant.walkInDays).includes(isoDay);
}

/** True when the location takes no online bookings on a "YYYY-MM-DD" date. */
export function isWalkInOnlyOnDate(restaurant: WalkInSource, date: string): boolean {
  return isWalkInOnlyOnDay(restaurant, getIsoDayFromDateString(date));
}

/** Human summary of the walk-in days, e.g. "Saturdays and Sundays". */
export function walkInDaysLabel(restaurant: WalkInSource): string | null {
  const days = parseWalkInDays(restaurant.walkInDays);
  if (days.length === 0) return null;
  const names = [...new Set(days)].sort().map((d) => DAY_NAMES[d - 1]);
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Single source of truth for the top-of-card status badge. Always reflects
 * the walk-in policy regardless of whether today happens to be a walk-in
 * day, so the badge never disappears and reappears as the date changes.
 * Returns `null` when the location takes online bookings every day.
 */
export function walkInBadgeLabel(restaurant: WalkInSource): string | null {
  if (restaurant.walkInOnly) return "Walk-ins only";
  const daysLabel = walkInDaysLabel(restaurant);
  return daysLabel ? `Walk-ins on ${daysLabel}` : null;
}
