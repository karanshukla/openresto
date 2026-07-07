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
