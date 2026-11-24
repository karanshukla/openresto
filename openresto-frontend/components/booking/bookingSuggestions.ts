import { getNowInTimezone } from "@/utils/date";
import {
  getHoursForDate,
  getLastBookingForDate,
  isOpenOnDate,
  HoursSource,
} from "@/utils/openingHours";
import { isWalkInOnlyOnDate, type WalkInSource } from "@/utils/walkIn";

/* istanbul ignore next */
function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().split("T")[0];
}

/**
 * The latest useful start on `dateStr`, in minutes from midnight: the day's last booking time
 * when it has one, otherwise the margin the form has always used (21:45 for a 22:00 close).
 *
 * @see [bookingSuggestions.test.ts](../../tests/components/booking/bookingSuggestions.test.ts)
 * — pins that a last booking time replaces the before-close margin.
 */
export function latestStartMinutes(restaurant: HoursSource, dateStr: string): number {
  const lastBooking = getLastBookingForDate(restaurant, dateStr);
  if (lastBooking) {
    const [h, m] = lastBooking.split(":").map(Number);
    return h * 60 + m;
  }
  const { close } = getHoursForDate(restaurant, dateStr);
  const [closeH] = close.split(":").map(Number);
  return (closeH - 1) * 60 + 45;
}

/**
 * Pick the earliest scheduled start at or after the current moment in the restaurant timezone.
 * Respect weekly closures, exceptions, walk-in-only dates, the last-booking cutoff, booking
 * interval and minimum notice. Actual remaining table availability is resolved by the API.
 * A null result means that the configured book-ahead horizon has no schedulable slot.
 */
export function suggestNextBooking(
  restaurant: HoursSource &
    WalkInSource & {
      bookingSlotIntervalMinutes?: number | null;
      minBookingNoticeMinutes?: number | null;
      maxBookingDaysAhead?: number | null;
    },
  timezone: string
): { date: string; time: string } | null {
  if (restaurant.walkInOnly) return null;

  const now = getNowInTimezone(timezone);
  const startMinute = now.hours * 60 + now.minutes;
  const interval = [15, 30, 60].includes(restaurant.bookingSlotIntervalMinutes ?? 15)
    ? (restaurant.bookingSlotIntervalMinutes ?? 15)
    : 15;
  const notice = Math.max(0, restaurant.minBookingNoticeMinutes ?? 0);
  const ahead = Math.min(366, Math.max(0, restaurant.maxBookingDaysAhead ?? 366));

  for (let day = 0; day <= ahead; day++) {
    const date = addDays(now.dateStr, day);
    if (!isOpenOnDate(restaurant, date) || isWalkInOnlyOnDate(restaurant, date)) continue;
    const { open } = getHoursForDate(restaurant, date);
    const [openHour, openMinute] = open.split(":").map(Number);
    const opening = openHour * 60 + openMinute;
    const earliest = Math.max(opening, startMinute + notice + 1 - day * 1440);
    const index = Math.max(0, Math.ceil((earliest - opening) / interval));
    const slot = opening + index * interval;
    if (slot <= latestStartMinutes(restaurant, date) && slot < 1440) {
      return {
        date,
        time: `${String(Math.floor(slot / 60)).padStart(2, "0")}:${String(slot % 60).padStart(2, "0")}`,
      };
    }
  }
  return null;
}

/** Suggested date of the next scheduled slot, or today if none exists in the book-ahead window. */
export function suggestDate(restaurant: HoursSource, timezone: string): string {
  return suggestNextBooking(restaurant, timezone)?.date ?? getNowInTimezone(timezone).dateStr;
}

/** Suggested start time, aligned with the suggested date rather than today's service hours. */
export function suggestTime(restaurant: HoursSource, timezone: string): string {
  return (
    suggestNextBooking(restaurant, timezone)?.time ??
    getHoursForDate(restaurant, suggestDate(restaurant, timezone)).open
  );
}
