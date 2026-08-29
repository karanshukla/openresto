import { Platform } from "react-native";
import { apiBaseUrl } from "@/utils/apiBaseUrl";

describe("apiBaseUrl", () => {
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    Object.defineProperty(Platform, "OS", { get: () => "web", configurable: true });
  });

  it("returns an absolute configured API URL untouched", () => {
    process.env.EXPO_PUBLIC_API_URL = "http://localhost:5062";
    expect(apiBaseUrl()).toBe("http://localhost:5062/api");
  });

  it("resolves a relative API path against the browser origin", () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    // The RN preset's `window` carries no location, so the browser case has to be staged.
    Object.defineProperty(window, "location", {
      value: { origin: "https://bookings.example.com" },
      configurable: true,
    });

    try {
      expect(apiBaseUrl()).toBe("https://bookings.example.com/api");
    } finally {
      Object.defineProperty(window, "location", { value: undefined, configurable: true });
    }
  });

  it("falls back to the supplied origin when the browser reports no location", () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(apiBaseUrl("https://fallback.example.com")).toBe("https://fallback.example.com/api");
  });

  it("falls back to the supplied origin off web", () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });

    expect(apiBaseUrl("https://bookings.example.com/")).toBe("https://bookings.example.com/api");
  });

  it("stays relative when no origin is known", () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    Object.defineProperty(Platform, "OS", { get: () => "ios", configurable: true });

    expect(apiBaseUrl()).toBe("/api");
  });
});
