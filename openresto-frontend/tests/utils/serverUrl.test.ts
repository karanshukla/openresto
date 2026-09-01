import { Platform } from "react-native";
import { resolveServerUrl } from "@/utils/serverUrl";

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });

describe("resolveServerUrl", () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalEnv;
    setPlatform("web");
  });

  it("returns every input untouched on web, where the browser resolves paths itself", () => {
    setPlatform("web");
    process.env.EXPO_PUBLIC_API_URL = "https://bookings.example.com/api";
    expect(resolveServerUrl("/media/hero.jpg?v=1")).toBe("/media/hero.jpg?v=1");
    expect(resolveServerUrl("https://cdn.example.com/menu.pdf")).toBe(
      "https://cdn.example.com/menu.pdf"
    );
  });

  it("joins a server-relative path onto the server root off web, dropping the /api segment", () => {
    setPlatform("ios");
    process.env.EXPO_PUBLIC_API_URL = "https://bookings.example.com/api";
    expect(resolveServerUrl("/media/location-3.jpg?v=1")).toBe(
      "https://bookings.example.com/media/location-3.jpg?v=1"
    );
    process.env.EXPO_PUBLIC_API_URL = "https://bookings.example.com/";
    expect(resolveServerUrl("/media/menu-3.pdf")).toBe(
      "https://bookings.example.com/media/menu-3.pdf"
    );
    process.env.EXPO_PUBLIC_API_URL = "https://example.com/resto/api";
    expect(resolveServerUrl("/media/menu-3.pdf")).toBe(
      "https://example.com/resto/media/menu-3.pdf"
    );
  });

  it("leaves absolute and protocol-relative URLs alone off web", () => {
    setPlatform("android");
    process.env.EXPO_PUBLIC_API_URL = "https://bookings.example.com";
    expect(resolveServerUrl("https://cdn.example.com/menu.pdf")).toBe(
      "https://cdn.example.com/menu.pdf"
    );
    expect(resolveServerUrl("data:image/svg+xml;utf8,<svg/>")).toBe(
      "data:image/svg+xml;utf8,<svg/>"
    );
    expect(resolveServerUrl("//cdn.example.com/x.png")).toBe("//cdn.example.com/x.png");
  });

  it("returns the path unchanged when no server is configured at all", () => {
    setPlatform("ios");
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(resolveServerUrl("/media/hero.jpg")).toBe("/media/hero.jpg");
  });
});
