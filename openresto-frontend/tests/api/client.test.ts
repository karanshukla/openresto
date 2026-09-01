import { Platform } from "react-native";
import Constants from "expo-constants";
import { buildUrl, api, configuredApiUrl, clientIdentity, CLIENT_HEADER } from "@/api/client";

// The real module exposes `expoConfig` as a getter, so the tests swap in a plain object they
// can point at whatever `extra` a build would have baked in.
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: null } }));

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("buildUrl", () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalEnv;
  });

  it("prepends /api when no EXPO_PUBLIC_API_URL is set", () => {
    process.env.EXPO_PUBLIC_API_URL = "";
    expect(buildUrl("/test")).toBe("/api/test");
  });

  it("handles base URL with trailing slash", () => {
    process.env.EXPO_PUBLIC_API_URL = "https://api.test.com/";
    expect(buildUrl("/foo")).toBe("https://api.test.com/api/foo");
  });

  it("handles base URL that already includes /api", () => {
    process.env.EXPO_PUBLIC_API_URL = "https://test.com/api";
    expect(buildUrl("/foo")).toBe("https://test.com/api/foo");
  });

  it("handles base URL without /api", () => {
    process.env.EXPO_PUBLIC_API_URL = "https://test.com";
    expect(buildUrl("/foo")).toBe("https://test.com/api/foo");
  });
});

describe("configuredApiUrl", () => {
  const originalEnv = process.env.EXPO_PUBLIC_API_URL;
  const mutable = Constants as unknown as { expoConfig: unknown };

  const withExtra = (extra: Record<string, unknown> | undefined) => {
    mutable.expoConfig = extra === undefined ? null : { name: "t", slug: "t", extra };
  };

  afterEach(() => {
    process.env.EXPO_PUBLIC_API_URL = originalEnv;
    mutable.expoConfig = null;
  });

  it("prefers EXPO_PUBLIC_API_URL over extra.apiUrl", () => {
    process.env.EXPO_PUBLIC_API_URL = "https://env.example";
    withExtra({ apiUrl: "https://extra.example" });
    expect(configuredApiUrl()).toBe("https://env.example");
  });

  it("falls back to extra.apiUrl baked in by app.config.ts when the env var is unset", () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    withExtra({ apiUrl: "https://bookings.example.com" });
    expect(buildUrl("/brand")).toBe("https://bookings.example.com/api/brand");
  });

  it("ignores a non-string or empty extra.apiUrl", () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    withExtra({ apiUrl: 42 });
    expect(configuredApiUrl()).toBeUndefined();
    withExtra({ apiUrl: "" });
    expect(configuredApiUrl()).toBeUndefined();
  });

  it("is undefined with no env var and no expo config", () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    withExtra(undefined);
    expect(configuredApiUrl()).toBeUndefined();
    expect(buildUrl("/x")).toBe("/api/x");
  });
});

describe("api", () => {
  it("sends GET with credentials: include by default", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await api("GET", "/foo");
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/foo");
    expect(opts.method).toBe("GET");
    expect(opts.credentials).toBe("include");
    expect(opts.body).toBeUndefined();
  });

  it("sends POST with JSON body and Content-Type header", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await api("POST", "/bar", { body: { key: "value" } });
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe("POST");
    expect(opts.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(opts.body)).toEqual({ key: "value" });
  });

  it("allows passing custom headers", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await api("GET", "/headers", { headers: { "X-Custom": "test" } });
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers["X-Custom"]).toBe("test");
  });

  it("does not set Content-Type when no body provided", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await api("DELETE", "/baz");
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.headers["Content-Type"]).toBeUndefined();
  });

  it("allows overriding credentials", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await api("GET", "/pub", { credentials: "omit" });
    expect(mockFetch.mock.calls[0][1].credentials).toBe("omit");
  });
});

describe("client identity header", () => {
  const mutable = Constants as unknown as { expoConfig: unknown };
  const setPlatform = (os: string) =>
    Object.defineProperty(Platform, "OS", { value: os, configurable: true });

  afterEach(() => {
    setPlatform("web");
    mutable.expoConfig = null;
  });

  it("sends nothing on web, where a custom header would cost a CORS preflight", async () => {
    setPlatform("web");
    expect(clientIdentity()).toBeUndefined();
    mockFetch.mockResolvedValueOnce({ ok: true });
    await api("GET", "/foo");
    expect(mockFetch.mock.calls[0][1].headers[CLIENT_HEADER]).toBeUndefined();
  });

  it("identifies a native build as platform/version", async () => {
    setPlatform("android");
    mutable.expoConfig = { name: "t", slug: "t", version: "1.9.0" };
    expect(clientIdentity()).toBe("android/1.9.0");
    mockFetch.mockResolvedValueOnce({ ok: true });
    await api("GET", "/foo");
    expect(mockFetch.mock.calls[0][1].headers[CLIENT_HEADER]).toBe("android/1.9.0");
  });

  it("falls back to 0.0.0 when the config carries no version", () => {
    setPlatform("ios");
    mutable.expoConfig = null;
    expect(clientIdentity()).toBe("ios/0.0.0");
  });
});
