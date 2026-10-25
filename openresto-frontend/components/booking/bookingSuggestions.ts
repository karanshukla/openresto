import { getNowInTimezone } from "@/utils/date";
import { getHoursForDate, getLastBookingForDate, HoursSource } from "@/utils/openingHours";

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
 * The date the booking form opens on: today while there is still time to start a sitting
 * (see {@link latestStartMinutes}), tomorrow once that has passed.
 */
export function suggestDate(restaurant: HoursSource, timezone: string): string {
  const { dateStr, hours, minutes } = getNowInTimezone(timezone);
  if (hours * 60 + minutes < latestStartMinutes(restaurant, dateStr)) {
    return dateStr;
  }
  /* istanbul ignore next */
  return addDays(dateStr, 1);
}

/**
 * The time the form opens on: the next quarter-hour in the restaurant's own timezone,
 * falling back to an hour after opening when that lands outside the day's hours.
 */
export function suggestTime(restaurant: HoursSource, timezone: string): string {
  const { dateStr, hours, minutes } = getNowInTimezone(timezone);
  const { open: openTime, close: closeTime } = getHoursForDate(restaurant, dateStr);
  let h = hours;
  const m = minutes < 15 ? 15 : minutes < 30 ? 30 : minutes < 45 ? 45 : 0;
  if (m === 0) h += 1;

  const [openH] = openTime.split(":").map(Number);
  const [closeH, closeM] = closeTime.split(":").map(Number);
  const closeTotal = closeH * 60 + closeM;
  const currentTotal = h * 60 + m;

  /* istanbul ignore next */
  if (currentTotal < openH * 60 || currentTotal > closeTotal) {
    return `${(openH + 1).toString().padStart(2, "0")}:00`;
  }
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}
