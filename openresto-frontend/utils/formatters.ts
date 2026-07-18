/**
 * Small shared formatting helpers used across the admin screens. Extracted from
 * app/admin/bookings/index.tsx where the same three utilities were defined inline.
 */

/**
 * Formats a Date as a short locale-aware label, e.g. "Sat, Apr 18".
 * Uses the runtime locale (undefined first arg) intentionally — admins see dates in their
 * own locale, not the restaurant's.
 */
export function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
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
