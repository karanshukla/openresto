import { DateExceptionDto, DayHoursDto } from "@/api/restaurants";
import { getDateException } from "@/utils/dateExceptions";
import { getRestaurantDate, getRestaurantNow, parseDayOfWeek } from "@/utils/restaurantTime";

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
  lastBookingTime?: string | null;
  dateExceptions?: DateExceptionDto[] | null;
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

/**
 * The latest start a guest may book online on `isoDay`: the day's own `lastBooking` when the
 * resolved week carries one, else the restaurant-wide `lastBookingTime`, else null, which means
 * bookings run up to closing time. Mirrors `OpeningHours.GetLastBookingForDay` on the server.
 *
 * @see [openingHours.test.ts](../tests/utils/openingHours.test.ts) — pins the day's own value
 * over the restaurant-wide one, and null when neither is set.
 */
export function getLastBookingForDay(restaurant: HoursSource, isoDay: number): string | null {
  const entry = restaurant.openHours?.find((h) => h.day === isoDay);
  return entry?.lastBooking || restaurant.lastBookingTime || null;
}

/**
 * The last booking time on a calendar date: a special-hours date carries only its own (null
 * meaning up to its close, since the weekly value was set for different hours); every other
 * date follows its weekday. Mirrors `ServiceWindowHelper.ScheduleFor` on the server.
 *
 * @see [openingHours.test.ts](../tests/utils/openingHours.test.ts) — pins that a special-hours
 * date without a cutoff drops the weekly one.
 */
export function getLastBookingForDate(restaurant: HoursSource, date: string): string | null {
  const exception = getDateException(restaurant, date);
  if (exception?.type === "specialHours") return exception.lastBooking || null;
  return getLastBookingForDay(restaurant, getIsoDayFromDateString(date));
}

const toMinutes = (time: string): number => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Whether `time` is a moment a service running `open` to `close` is serving: opening inclusive,
 * closing exclusive, the two equal meaning all day, and a close before the open wrapping past
 * midnight. The server's `ServiceWindowHelper.CoversTimeOfDay`, mirrored so the form can state
 * why a save is withheld before the round-trip.
 *
 * @see [openingHours.test.ts](../tests/utils/openingHours.test.ts) — pins the closing time as
 * outside and the wrap of an overnight window.
 */
export function isWithinServiceWindow(open: string, close: string, time: string): boolean {
  const o = toMinutes(open);
  const c = toMinutes(close);
  const t = toMinutes(time);
  if (o === c) return true;
  return c < o ? t >= o || t < c : t >= o && t < c;
}

const END_OF_DAY = "23:45";

const timesBetween = (from: number, to: number): string[] => {
  const times: string[] = [];
  for (let m = from; m <= to; m += 15) {
    times.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return times;
};

/**
 * Every quarter-hour a last booking time may be set to for a service running `open` to `close`:
 * from the opening up to a quarter before close, running on past midnight when the window does.
 *
 * @see [openingHours.test.ts](../tests/utils/openingHours.test.ts) — pins that the closing time
 * itself is never offered and that an overnight window continues into the next morning.
 */
export function lastBookingOptions(open: string, close: string): string[] {
  const o = toMinutes(open);
  const c = toMinutes(close);
  if (o === c) return timesBetween(0, toMinutes(END_OF_DAY));
  if (c > o) return timesBetween(o, c - 15);
  return [...timesBetween(o, toMinutes(END_OF_DAY)), ...timesBetween(0, c - 15)];
}

/**
 * The bounds the guest booking form's time picker runs between for one day's hours. A close at
 * or before the open is a past-midnight service, so the picker runs to the end of the day; a
 * last booking time before midnight caps it earlier, while one after midnight cannot be
 * expressed on this day's picker and is answered by the server's slot list instead.
 *
 * @see [openingHours.test.ts](../tests/utils/openingHours.test.ts) — pins that a last booking
 * before midnight caps the picker and one after midnight leaves the overnight cap alone.
 */
export function bookingTimePickerBounds(hours: {
  open: string;
  close: string;
  lastBooking: string | null;
}): { min: string; max: string } {
  const overnight = hours.close <= hours.open;
  let max = overnight ? END_OF_DAY : hours.close;
  if (hours.lastBooking && hours.lastBooking >= hours.open && hours.lastBooking < max) {
    max = hours.lastBooking;
  }
  return { min: hours.open, max };
}

export function getIsoDayFromDateString(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const jsDay = new Date(y, (m || 1) - 1, d || 1).getDay();
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * The hours on a calendar date: a special-hours date's own, otherwise its weekday's.
 *
 * @see [openingHours.test.ts](../tests/utils/openingHours.test.ts) — pins that special hours
 * replace the weekday's and that the next day falls back to the week.
 */
export function getHoursForDate(
  restaurant: HoursSource,
  date: string
): { open: string; close: string } {
  const exception = getDateException(restaurant, date);
  if (exception?.type === "specialHours" && exception.open && exception.close) {
    return { open: exception.open, close: exception.close };
  }
  return getHoursForDay(restaurant, getIsoDayFromDateString(date));
}

/**
 * Whether the location runs a service on a calendar date: a closed date is shut whatever the
 * week says, a special-hours date is open whatever the week says, and any other date follows
 * the weekly open days. The guest surface asks this instead of `openDays.includes(isoDay)`
 * wherever a specific date is in hand, so a bank holiday reads as closed before the server has
 * to say so.
 *
 * `openDays` is taken from the caller when it has already resolved the week, because the two
 * parsers in this codebase disagree on the empty string (see {@link getNextOpening}); left out,
 * the week is read the way the server reads it: day names and numbers alike, and an empty list
 * meaning every day.
 *
 * @see [openingHours.test.ts](../tests/utils/openingHours.test.ts) — pins a closed date on an
 * open weekday and special hours on a closed weekday.
 */
export function isOpenOnDate(restaurant: HoursSource, date: string, openDays?: number[]): boolean {
  const exception = getDateException(restaurant, date);
  if (exception?.type === "closed") return false;
  if (exception?.type === "specialHours") return true;
  const isoDay = getIsoDayFromDateString(date);
  if (openDays) return openDays.includes(isoDay);
  const week = weeklyOpenDays(restaurant.openDays);
  return week.length === 0 || week.includes(isoDay);
}

/**
 * Whether the location is serving right now, judged in its own timezone the way the server's
 * `IsServingAt` judges it: today's service, or yesterday's if it runs past midnight. Equal open
 * and close times mean all day. Each day is read as a date, so date exceptions apply.
 */
export function isOpenNow(restaurant: HoursSource & { timezone?: string | null }): boolean {
  const timezone = restaurant.timezone || "UTC";
  const { totalMins } = getRestaurantNow(timezone);
  const today = getRestaurantDate(timezone);
  const todayHours = getHoursForDate(restaurant, today);
  const open = toMinutes(todayHours.open);
  const close = toMinutes(todayHours.close);
  if (isNaN(open) || isNaN(close)) return true;
  // Today's service, up to midnight when it runs past it.
  if (isOpenOnDate(restaurant, today)) {
    if (open === close) return true;
    if (totalMins >= open && (close < open || totalMins < close)) return true;
  }

  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const prev = yesterday.toISOString().slice(0, 10);
  const prevHours = getHoursForDate(restaurant, prev);
  const prevClose = toMinutes(prevHours.close);
  return (
    prevClose < toMinutes(prevHours.open) && isOpenOnDate(restaurant, prev) && totalMins < prevClose
  );
}

/** The weekly open days as the server reads them: names or numbers, anything else dropped. */
function weeklyOpenDays(openDays?: string | null): number[] {
  return (openDays ?? "")
    .split(",")
    .map((d) => parseDayOfWeek(d.trim()))
    .filter((d) => d > 0);
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
  return hours.some(
    (h) =>
      h.open !== hours[0].open ||
      h.close !== hours[0].close ||
      (h.lastBooking ?? null) !== (hours[0].lastBooking ?? null)
  );
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
