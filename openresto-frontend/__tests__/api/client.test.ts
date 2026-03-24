import { buildUrl, api } from "@/api/client";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("buildUrl", () => {
  it("prepends /api when no EXPO_PUBLIC_API_URL is set", () => {
    expect(buildUrl("/test")).toBe("/api/test");
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
