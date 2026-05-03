import { createHold, releaseHold } from "@/api/holds";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("createHold", () => {
  const request = {
    restaurantId: 1,
    tableId: 5,
    sectionId: 2,
    date: "2026-06-15T19:00:00Z",
  };

  it("posts hold request and returns hold response", async () => {
    const holdResp = {
      holdId: "abc-123",
      expiresAt: "2026-06-15T19:05:00Z",
      secondsRemaining: 300,
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => holdResp,
    });

    const result = await createHold(request);
    expect(result).toEqual(holdResp);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/holds");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual(request);
  });

  it("returns null on 409 (table already held)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 409 });

    const result = await createHold(request);
    expect(result).toBeNull();
  });

  it("returns null on server error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await createHold(request);
    expect(result).toBeNull();
  });

  it("returns null on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));

    const result = await createHold(request);
    expect(result).toBeNull();
  });
});

describe("releaseHold", () => {
  it("sends DELETE to /api/holds/:holdId", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await releaseHold("abc-123");
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/holds/abc-123");
    expect(opts.method).toBe("DELETE");
  });

  it("does not throw on network failure (fire-and-forget)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));

    // Should not throw
    await expect(releaseHold("abc-123")).resolves.toBeUndefined();
  });
});
