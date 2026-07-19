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
    expect(result).toEqual({ ok: true, hold: holdResp });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/holds");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual(request);
  });

  it("surfaces backend message on 400 past-time rejection", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: "Cannot hold a table for a past time." }),
    });

    const result = await createHold(request);
    expect(result).toEqual({ ok: false, message: "Cannot hold a table for a past time." });
  });

  it("surfaces backend message on 409 (table already held)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ message: "This table is already booked for that time." }),
    });

    const result = await createHold(request);
    expect(result).toEqual({ ok: false, message: "This table is already booked for that time." });
  });

  it("falls back to generic message when 4xx has no body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => {
        throw new Error("no json");
      },
    });

    const result = await createHold(request);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Table not available for this date. Please choose another.");
    }
  });

  it("returns generic failure on server error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

    const result = await createHold(request);
    expect(result.ok).toBe(false);
  });

  it("returns generic failure on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));

    const result = await createHold(request);
    expect(result.ok).toBe(false);
  });

  it("posts auto-assign hold (null table/section + seats) and returns resolved table", async () => {
    // "Any section" request: null tableId/sectionId + seats, so the server picks the table.
    const autoRequest = {
      restaurantId: 1,
      tableId: null,
      sectionId: null,
      seats: 2,
      date: "2026-06-15T19:00:00Z",
    };
    const holdResp = {
      holdId: "auto-1",
      expiresAt: "2026-06-15T19:05:00Z",
      secondsRemaining: 300,
      tableId: 42, // server-resolved
      sectionId: 7,
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => holdResp,
    });

    const result = await createHold(autoRequest);
    expect(result).toEqual({ ok: true, hold: holdResp });
    const [, opts] = mockFetch.mock.calls[0];
    expect(JSON.parse(opts.body)).toEqual(autoRequest);
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
