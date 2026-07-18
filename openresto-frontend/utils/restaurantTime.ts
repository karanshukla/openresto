import { RestaurantDto } from "@/api/restaurants";

/**
 * Restaurant-local time helpers. Resolves "now" against a restaurant's IANA
 * timezone via `Intl.DateTimeFormat`, so the open/closed and "opens in"
 * badges reflect the wall-clock where the location actually is.
 *
 * Hoisted out of `RestaurantCard` (its original home) so `OpeningHoursTable`
 * and other per-day UI don't reimplement the timezone math a third time.
 */

const WEEKDAY_TO_ISO: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

/** Current local "HH:MM in minutes since midnight" + ISO day (1=Mon … 7=Sun) for a tz. */
export function getRestaurantNow(timezone: string): { totalMins: number; isoDay: number } {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      weekday: "long",
      hour12: false,
    }).formatToParts(now);
    const rawHour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24;
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Monday";
    return { totalMins: rawHour * 60 + minute, isoDay: WEEKDAY_TO_ISO[weekday] ?? 1 };
  } catch {
    const now = new Date();
    const jsDay = now.getDay();
    return {
      totalMins: now.getHours() * 60 + now.getMinutes(),
      isoDay: jsDay === 0 ? 7 : jsDay,
    };
  }
}

/** Today's local date ("YYYY-MM-DD") for a tz. */
export function getRestaurantDate(timezone: string): string {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const year = parts.find((p) => p.type === "year")?.value ?? "";
    const month = parts.find((p) => p.type === "month")?.value ?? "";
    const day = parts.find((p) => p.type === "day")?.value ?? "";
    return `${year}-${month}-${day}`;
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

/** Parses a single OpenDays token (ISO number or weekday prefix) to an ISO day, 0 if unparseable. */
export function parseDayOfWeek(day: string): number {
  const num = parseInt(day, 10);
  if (!isNaN(num) && num >= 1 && num <= 7) return num;

  const lower = day.toLowerCase();
  if (lower.startsWith("mon")) return 1;
  if (lower.startsWith("tue")) return 2;
  if (lower.startsWith("wed")) return 3;
  if (lower.startsWith("thu")) return 4;
  if (lower.startsWith("fri")) return 5;
  if (lower.startsWith("sat")) return 6;
  if (lower.startsWith("sun")) return 7;
  return 0;
}

/** ISO day numbers the restaurant is open, parsed from its comma-separated OpenDays string. */
export function getOpenDaysList(restaurant: Pick<RestaurantDto, "openDays">): number[] {
  return (
    restaurant.openDays
      ?.split(",")
      .map((d) => parseDayOfWeek(d.trim()))
      .filter((d) => d > 0) ?? [1, 2, 3, 4, 5, 6, 7]
  );
}
