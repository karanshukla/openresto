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
