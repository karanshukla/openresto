import { Platform } from "react-native";
import { bookingConfirmationLink } from "@/utils/bookingLink";

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, "OS", { get: () => os, configurable: true });

describe("bookingConfirmationLink", () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalEnv;
    setPlatform("web");
  });

  it("builds the email's confirmation URL from the brand's website URL, trailing slash or not", () => {
    setPlatform("ios");
    process.env.EXPO_PUBLIC_API_URL = "https://api.example.com/api";
    expect(bookingConfirmationLink("REF123", "a@b.com", "https://bookings.example.com/")).toBe(
      "https://bookings.example.com/booking-confirmation/REF123?email=a%40b.com"
    );
    expect(bookingConfirmationLink("REF123", "a@b.com", "https://bookings.example.com")).toBe(
      "https://bookings.example.com/booking-confirmation/REF123?email=a%40b.com"
    );
  });

  it("falls back to the build's server root off web, dropping the /api segment", () => {
    setPlatform("android");
    process.env.EXPO_PUBLIC_API_URL = "https://bookings.example.com/api";
    expect(bookingConfirmationLink("REF123", "a@b.com")).toBe(
      "https://bookings.example.com/booking-confirmation/REF123?email=a%40b.com"
    );
    process.env.EXPO_PUBLIC_API_URL = "https://example.com/resto/api/";
    expect(bookingConfirmationLink("REF123", "a@b.com")).toBe(
      "https://example.com/resto/booking-confirmation/REF123?email=a%40b.com"
    );
  });

  it("falls back to the page's own origin on web", () => {
    setPlatform("web");
    delete process.env.EXPO_PUBLIC_API_URL;
    Object.defineProperty(window, "location", {
      value: { origin: "https://bookings.example.com" },
      configurable: true,
    });
    try {
      expect(bookingConfirmationLink("REF123", "a@b.com")).toBe(
        "https://bookings.example.com/booking-confirmation/REF123?email=a%40b.com"
      );
    } finally {
      Object.defineProperty(window, "location", { value: undefined, configurable: true });
    }
  });

  it("returns nothing when no origin is known, rather than a relative path", () => {
    setPlatform("ios");
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(bookingConfirmationLink("REF123", "a@b.com")).toBeUndefined();
  });

  it("escapes the reference and the email, and omits the query without an email", () => {
    expect(
      bookingConfirmationLink("A/B C", "x+y@example.com", "https://bookings.example.com")
    ).toBe("https://bookings.example.com/booking-confirmation/A%2FB%20C?email=x%2By%40example.com");
    expect(bookingConfirmationLink("REF123", undefined, "https://bookings.example.com")).toBe(
      "https://bookings.example.com/booking-confirmation/REF123"
    );
  });
});
