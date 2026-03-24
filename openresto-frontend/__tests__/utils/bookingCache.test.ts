import { fetchCachedBookings } from "@/utils/bookingCache";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("fetchCachedBookings", () => {
  it("fetches from /api/bookings/my-recent with credentials", async () => {
    const cached = [
      {
        bookingRef: "crispy-basil",
        email: "a@b.com",
        date: "2026-06-15",
        seats: 2,
        createdAt: "2026-06-15",
      },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => cached,
    });

    const result = await fetchCachedBookings();
    expect(result).toEqual(cached);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/bookings/my-recent");
    expect(opts.credentials).toBe("include");
  });

  it("returns empty array on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await fetchCachedBookings();
    expect(result).toEqual([]);
  });

  it("returns empty array on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));

    const result = await fetchCachedBookings();
    expect(result).toEqual([]);
  });
});
