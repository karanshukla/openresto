/**
 * Formats a Date as a short locale-aware label, e.g. "Sat, Apr 18".
 * Uses the runtime locale (undefined first arg) intentionally — users see dates in their
 * own locale, not the restaurant's.
 */
export function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** fmtDate for a YYYY-MM-DD string; noon avoids timezone rollover to an adjacent day. */
export function fmtDateString(yyyyMmDd: string): string {
  return fmtDate(new Date(yyyyMmDd + "T12:00:00"));
}

/**
 * Formats a Date as a naive YYYY-MM-DD string (no timezone offset). Used for query params
 * where the backend reinterprets the date in the restaurant's timezone.
 */
export function isoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Compact relative timestamp: "just now", "5m ago", "3h ago", "2d ago". */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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
