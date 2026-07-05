import { isValidEmail } from "@/utils/validation";

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
