import {
  isValidEmail,
  isValidUrl,
  validatePasswordChange,
  WEB_AND_CONTACT_SCHEMES,
  WEB_SCHEMES,
} from "@/utils/validation";

describe("validation utility - isValidEmail", () => {
  it.each([
    "user@example.com",
    "john.doe@sub.example.co.uk",
    "a@b.co",
    "  trim-me@example.com  ",
    "Plus+Alias@example.com",
  ])("accepts %p", (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each([
    "",
    "   ",
    "no-at-sign.com",
    "no-tld@example",
    "spaces @example.com",
    "@nouser.com",
    "nouser@.com",
  ])("rejects %p", (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});

describe("validation utility - isValidUrl", () => {
  it.each([
    "https://example.com",
    "http://localhost:8081/menu.pdf",
    "https://instagram.com/yourresto",
    "mailto:hello@example.com",
    "tel:+15551234567",
    "sms:+15551234567",
    "  https://example.com  ",
  ])("accepts %p (default web+contact schemes)", (url) => {
    expect(isValidUrl(url)).toBe(true);
  });

  it.each([
    "",
    "   ",
    "asdf",
    "javascript:alert(1)",
    "data:text/html,<script>",
    "/media/menu-1.pdf",
    "//example.com/menu",
    "ftp://example.com",
  ])("rejects %p", (url) => {
    expect(isValidUrl(url)).toBe(false);
  });

  it("respects a custom allow-list (web-only)", () => {
    expect(isValidUrl("https://example.com", WEB_SCHEMES)).toBe(true);
    expect(isValidUrl("mailto:hello@example.com", WEB_SCHEMES)).toBe(false);
    expect(isValidUrl("tel:+15551234567", WEB_SCHEMES)).toBe(false);
  });

  it("exports the scheme constants", () => {
    expect(WEB_AND_CONTACT_SCHEMES).toEqual(["http:", "https:", "mailto:", "tel:", "sms:"]);
    expect(WEB_SCHEMES).toEqual(["http:", "https:"]);
  });
});

describe("validation utility - validatePasswordChange", () => {
  it("returns a match-failure when passwords differ", () => {
    expect(validatePasswordChange("secret1", "secret2")).toEqual({
      ok: false,
      error: "Passwords do not match.",
    });
  });

  it("returns a length-failure when under 6 chars (and matching)", () => {
    expect(validatePasswordChange("abc123".slice(0, 5), "abc123".slice(0, 5))).toEqual({
      ok: false,
      error: "Password must be at least 6 characters.",
    });
  });

  it("checks mismatch before length (preserving original order)", () => {
    // Two short non-matching passwords: mismatch wins over length.
    expect(validatePasswordChange("ab", "cd")).toEqual({
      ok: false,
      error: "Passwords do not match.",
    });
  });

  it("passes when matching and >= 6 chars", () => {
    expect(validatePasswordChange("secret", "secret")).toEqual({ ok: true });
  });
});
