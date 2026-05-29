import { fetchAvailability } from "@/api/availability";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("fetchAvailability", () => {
  const mockData = {
    restaurantId: 1,
    date: "2026-06-01",
    slots: [
      { time: "12:00", isAvailable: true, availableTableIds: [1, 2], category: "Lunch" as const },
    ],
  };

  it("fetches availability and returns data on success", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockData });

    const result = await fetchAvailability(1, "2026-06-01", 2);

    expect(result).toEqual(mockData);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/availability/1");
    expect(url).toContain("date=2026-06-01");
    expect(url).toContain("seats=2");
  });

  it("returns null when response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await fetchAvailability(1, "2026-06-01", 2);

    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await fetchAvailability(1, "2026-06-01", 2);

    expect(result).toBeNull();
  });

  it("constructs URL with correct query parameters", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockData });

    await fetchAvailability(42, "2026-12-31", 4);

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/availability/42");
    expect(url).toContain("date=2026-12-31");
    expect(url).toContain("seats=4");
  });
});
