import { buildUrl, api } from "@/api/client";

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
