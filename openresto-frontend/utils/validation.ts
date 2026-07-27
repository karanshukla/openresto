/**
 * Centralised lightweight input validation. The email check mirrors the backend EmailValidator
 * regex. This is a deliberately loose check (not RFC 5322); strict validation happens via the
 * confirmation email round-trip.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

/**
 * Absolute-URL schemes permitted for social-link and highlight URLs (web + contact). Mirrors
 * the backend <c>UrlValidator.WebAndContactSchemes</c> allow-list — the backend is the source
 * of truth, this is a UX pre-flight so the admin doesn't wait for a round-trip on obvious typos.
 */
export const WEB_AND_CONTACT_SCHEMES = ["http:", "https:", "mailto:", "tel:", "sms:"];

/**
 * Web-only schemes (http/https). Mirrors <c>UrlValidator.WebSchemes</c>. Used for fields like
 * <c>MenuUrl</c> that are web links.
 */
export const WEB_SCHEMES = ["http:", "https:"];

/**
 * Returns true when <code>value</code> is a non-blank, well-formed absolute URL whose scheme is
 * in <code>allowedSchemes</code>. Defaults to {@link WEB_AND_CONTACT_SCHEMES}. Mirrors the
 * backend <c>UrlValidator.IsValid</c>: same <c>URL</c> parse + scheme allow-list approach (the
 * scheme check is the security gate — <c>new URL</c> alone parses <c>javascript:</c> happily).
 */
export function isValidUrl(
  value: string,
  allowedSchemes: string[] = WEB_AND_CONTACT_SCHEMES
): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  return allowedSchemes.includes(parsed.protocol.toLowerCase());
}

/**
 * Shared validation for a password-change / password-reset flow. Consolidates the previously
 * duplicated match-then-length checks that lived inline in the login screen and SecurityCard.
 * Returns the first failure (preserving the original check order) or `{ ok: true }`.
 */
export function validatePasswordChange(
  newPassword: string,
  confirmPassword: string
): { ok: true } | { ok: false; error: string } {
  if (newPassword !== confirmPassword) {
    return { ok: false, error: "Passwords do not match." };
  }
  if (newPassword.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }
  return { ok: true };
}
