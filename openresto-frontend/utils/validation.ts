/**
 * Centralised lightweight input validation. Currently only email shape-checking — the same
 * regex that the backend uses in EmailValidator. This is a deliberately loose check (not
 * RFC 5322); strict validation happens via the confirmation email round-trip.
 */

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}
