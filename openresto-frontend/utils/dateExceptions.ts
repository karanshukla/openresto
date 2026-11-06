import type { DateExceptionDto, DateExceptionType } from "@/api/restaurants";

/**
 * Shared helpers for a location's date exceptions: the dates that depart from the weekly
 * schedule. Which hours or policy a date ends up with is answered by `utils/openingHours.ts`
 * (`getHoursForDate`, `isOpenOnDate`) and `utils/walkIn.ts` (`isWalkInOnlyOnDate`), which all
 * read the exception through here, so the three cannot disagree about which entry applies.
 */

export interface DateExceptionSource {
  dateExceptions?: DateExceptionDto[] | null;
}

export const DATE_EXCEPTION_TYPES: readonly DateExceptionType[] = [
  "closed",
  "specialHours",
  "walkInOnly",
];

/** The exception on a "YYYY-MM-DD" date, or null for a weekly-schedule day. */
export function getDateException(
  restaurant: DateExceptionSource,
  date: string
): DateExceptionDto | null {
  return restaurant.dateExceptions?.find((e) => e.date === date) ?? null;
}

/**
 * The exceptions on or after `fromDate` ("YYYY-MM-DD"), earliest first. The server already
 * drops past dates on save, but a list loaded yesterday can still carry yesterday.
 *
 * @see [dateExceptions.test.ts](../tests/utils/dateExceptions.test.ts) — pins that today is
 * kept and yesterday dropped, and that the result is sorted.
 */
export function upcomingDateExceptions(
  restaurant: DateExceptionSource,
  fromDate: string
): DateExceptionDto[] {
  return [...(restaurant.dateExceptions ?? [])]
    .filter((e) => e.date >= fromDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** The dates of every exception of one type, for a date picker that marks days by list. */
export function dateExceptionDates(
  restaurant: DateExceptionSource,
  type: DateExceptionType
): string[] {
  return (restaurant.dateExceptions ?? []).filter((e) => e.type === type).map((e) => e.date);
}

/**
 * Replaces or appends the entry for `next.date`, keeping the list in date order. The admin
 * form edits the list through this so a date can never appear twice, which is also the rule
 * the server enforces (`restaurant.date_exception_duplicate_date`).
 *
 * @see [dateExceptions.test.ts](../tests/utils/dateExceptions.test.ts) — pins that a second
 * entry on the same date replaces the first.
 */
export function upsertDateException(
  list: DateExceptionDto[],
  next: DateExceptionDto
): DateExceptionDto[] {
  return [...list.filter((e) => e.date !== next.date), next].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

export function removeDateException(list: DateExceptionDto[], date: string): DateExceptionDto[] {
  return list.filter((e) => e.date !== date);
}
