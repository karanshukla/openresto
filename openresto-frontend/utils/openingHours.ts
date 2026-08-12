import { DayHoursDto } from "@/api/restaurants";

/**
 * Shared helpers for per-day opening hours. The API returns `openHours` as a
 * resolved 7-entry list (ISO day 1=Monday … 7=Sunday); anywhere it is missing
 * (older payloads, partial objects) we fall back to the restaurant-wide
 * openTime/closeTime pair.
 */

export interface HoursSource {
  openTime?: string | null;
  closeTime?: string | null;
  openHours?: DayHoursDto[] | null;
  openDays?: string | null;
}

const DEFAULT_OPEN = "09:00";
const DEFAULT_CLOSE = "22:00";

export function getHoursForDay(
  restaurant: HoursSource,
  isoDay: number
): { open: string; close: string } {
  const entry = restaurant.openHours?.find((h) => h.day === isoDay);
  return {
    open: entry?.open ?? restaurant.openTime ?? DEFAULT_OPEN,
    close: entry?.close ?? restaurant.closeTime ?? DEFAULT_CLOSE,
  };
}

export function getIsoDayFromDateString(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const jsDay = new Date(y, (m || 1) - 1, d || 1).getDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function getHoursForDate(
  restaurant: HoursSource,
  date: string
): { open: string; close: string } {
  return getHoursForDay(restaurant, getIsoDayFromDateString(date));
}

export function parseOpenDays(openDays?: string | null): number[] {
  if (!openDays) return [1, 2, 3, 4, 5, 6, 7];
  const days = openDays
    .split(",")
    .map((d) => parseInt(d.trim(), 10))
    .filter((d) => d >= 1 && d <= 7);
  return days.length > 0 ? days : [1, 2, 3, 4, 5, 6, 7];
}

export function hasCustomHours(restaurant: HoursSource): boolean {
  const hours = restaurant.openHours;
  if (!hours || hours.length === 0) return false;
  return hours.some((h) => h.open !== hours[0].open || h.close !== hours[0].close);
}

const DAY_NAMES_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function isoDayShortName(isoDay: number): string {
  return DAY_NAMES_SHORT[isoDay - 1] ?? "";
}

/**
 * The next day the location opens, searching forward from (and excluding) `fromIsoDay`.
 * Returns null when the location is closed every day.
 *
 * `openDays` is passed in rather than parsed from the restaurant because the two parsers
 * in this codebase disagree on the empty string — {@link parseOpenDays} reads it as
 * "every day", `getOpenDaysList` as "no days". Taking the caller's already-resolved list
 * guarantees this answer agrees with whatever decided the location was closed.
 */
export function getNextOpening(
  restaurant: HoursSource,
  fromIsoDay: number,
  openDays: number[]
): { isoDay: number; open: string } | null {
  for (let step = 1; step <= 7; step++) {
    const isoDay = ((fromIsoDay - 1 + step) % 7) + 1;
    if (openDays.includes(isoDay)) {
      return { isoDay, open: getHoursForDay(restaurant, isoDay).open };
    }
  }
  return null;
}

/**
 * Short human summary of a restaurant's hours: the single range when uniform,
 * or the hours for the requested day plus a "varies" hint otherwise.
 */
export function summarizeHours(restaurant: HoursSource, isoDay?: number): string {
  if (!hasCustomHours(restaurant)) {
    const { open, close } = getHoursForDay(restaurant, 1);
    return `${open}–${close}`;
  }
  if (isoDay) {
    const { open, close } = getHoursForDay(restaurant, isoDay);
    return `${open}–${close} today`;
  }
  return "Varies by day";
}
