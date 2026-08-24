import { getActiveLocale } from "@/utils/locale";

/** Formats a Date as a short label, e.g. "Sat, Apr 18". */
export function fmtDate(d: Date): string {
  return d.toLocaleDateString(getActiveLocale(), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** fmtDate for a YYYY-MM-DD string; noon avoids timezone rollover to an adjacent day. */
export function fmtDateString(yyyyMmDd: string): string {
  return fmtDate(new Date(yyyyMmDd + "T12:00:00"));
}

/** Formats a Date as a naive YYYY-MM-DD string (no timezone offset). Used for query params
 * where the backend reinterprets the date in the restaurant's timezone. */
export function isoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Formats a Date as a time, e.g. "19:30" or "7:30 PM" depending on locale. */
export function fmtTime(d: Date): string {
  return d.toLocaleTimeString(getActiveLocale(), { hour: "2-digit", minute: "2-digit" });
}

/** Compact date + time, e.g. "Sat, Apr 18, 7:30 PM". */
export function fmtDateTime(d: Date): string {
  return d.toLocaleString(getActiveLocale(), {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Date + time in a specific IANA timezone rather than the viewer's own, e.g. for a sitting
 * displayed against the restaurant's clock. */
export function fmtDateTimeInZone(iso: string, timezone: string): string {
  return new Date(iso).toLocaleString(getActiveLocale(), {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formats a Date as an abbreviated weekday, e.g. "Sat". */
export function fmtWeekday(d: Date): string {
  return d.toLocaleDateString(getActiveLocale(), { weekday: "short" });
}

/** Formats a Date as month + day, e.g. "Apr 18". */
export function fmtMonthDay(d: Date): string {
  return d.toLocaleDateString(getActiveLocale(), { month: "short", day: "numeric" });
}

/** Formats a Date as a full date, e.g. "Saturday, 18 April 2025". */
export function fmtLongDate(d: Date): string {
  return d.toLocaleDateString(getActiveLocale(), {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Formats a Date as a bare year, e.g. "2025". */
export function fmtYear(d: Date): string {
  return d.toLocaleDateString(getActiveLocale(), { year: "numeric" });
}

/** Full local timestamp for an ISO instant, e.g. "Apr 18, 2025, 7:30:00 PM". */
export function fmtTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(getActiveLocale(), {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

/** Formats a number with locale-appropriate thousands grouping. */
export function fmtNumber(n: number): string {
  return n.toLocaleString(getActiveLocale());
}

/** Compact relative timestamp: "now", "5m ago", "3h ago", "2d ago" (localized). */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const rtf = new Intl.RelativeTimeFormat(getActiveLocale(), { numeric: "auto", style: "narrow" });
  if (mins < 1) return rtf.format(0, "second");
  if (mins < 60) return rtf.format(-mins, "minute");
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return rtf.format(-hrs, "hour");
  return rtf.format(-Math.floor(hrs / 24), "day");
}

/**
 * Returns a 1–2 character uppercase label for a name or email — first+last initials for
 * multi-word names, first two chars otherwise. Email prefixes have separators stripped so
 * "john.doe@example.com" → "JD".
 */
export function initials(nameOrEmail: string): string {
  const name = nameOrEmail.includes("@")
    ? nameOrEmail.split("@")[0].replace(/[._-]/g, " ").trim()
    : nameOrEmail.trim();
  const parts = name.split(" ");
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}
