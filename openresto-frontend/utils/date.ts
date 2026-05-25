/**
 * Returns the current date and time components expressed in the given IANA timezone.
 * Safe fallback to user local time if the timezone is invalid.
 */
export function getNowInTimezone(timezone: string): {
  dateStr: string;
  hours: number;
  minutes: number;
} {
  const now = new Date();
  const tz = timezone || "UTC";
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
    const h = parseInt(get("hour"), 10);
    return {
      dateStr: `${get("year")}-${get("month")}-${get("day")}`,
      hours: h === 24 ? 0 : h,
      minutes: parseInt(get("minute"), 10),
    };
  } catch {
    return {
      dateStr: now.toISOString().split("T")[0],
      hours: now.getHours(),
      minutes: now.getMinutes(),
    };
  }
}

/**
 * Formats the current time in the given IANA timezone as a human-readable string
 * e.g. "3:45 PM".
 */
export function formatCurrentTimeInTimezone(timezone: string): string {
  const now = new Date();
  const tz = timezone || "UTC";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(now);
  } catch {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(now);
  }
}

/**
 * Converts a local date and time string (e.g. "2026-04-18" and "15:00")
 * into a UTC ISO string, interpreted in the context of a specific timezone.
 */
export function convertLocalToUtc(date: string, time: string, timezone: string): string {
  try {
    const localStr = `${date}T${time}:00`;
    const tz = timezone || "UTC";

    // Use Intl.DateTimeFormat to find the offset of the target timezone relative to UTC
    // by comparing a "local-looking" parse with its localized output.
    const tempDate = new Date(localStr);
    const targetStr = tempDate.toLocaleString("en-US", { timeZone: tz });
    const targetDate = new Date(targetStr);
    const diff = tempDate.getTime() - targetDate.getTime();

    return new Date(tempDate.getTime() + diff).toISOString();
  } catch {
    // Fallback to standard local parsing if timezone is invalid
    return new Date(`${date}T${time}:00`).toISOString();
  }
}

/**
 * Checks if a UTC date string represents "today" in a specific timezone.
 */
export function isTodayInTimezone(utcDateStr: string, timezone: string): boolean {
  try {
    const date = new Date(utcDateStr);
    const tz = timezone || "UTC";

    const nowInTz = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
    const dateInTz = new Date(date.toLocaleString("en-US", { timeZone: tz }));

    return (
      nowInTz.getFullYear() === dateInTz.getFullYear() &&
      nowInTz.getMonth() === dateInTz.getMonth() &&
      nowInTz.getDate() === dateInTz.getDate()
    );
  } catch {
    return false;
  }
}
