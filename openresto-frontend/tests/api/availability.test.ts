import { fetchAvailability } from "@/api/availability";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  jest.spyOn(console, "error").mockImplementation();
});

describe("fetchAvailability", () => {
  it("fetches availability for given params and returns data", async () => {
    const data = {
      restaurantId: 1,
      date: "2026-06-15",
      slots: [{ time: "19:00", isAvailable: true, availableTableIds: [1], category: "Dinner" }],
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => data });

    const result = await fetchAvailability(1, "2026-06-15", 2);

    expect(result).toEqual(data);
    expect(mockFetch.mock.calls[0][0]).toContain("/availability/1");
    expect(mockFetch.mock.calls[0][0]).toContain("date=2026-06-15");
    expect(mockFetch.mock.calls[0][0]).toContain("seats=2");
  });

  it("returns null when response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await fetchAvailability(1, "2026-06-15", 2);

    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network failure"));

    const result = await fetchAvailability(1, "2026-06-15", 2);

    expect(result).toBeNull();
  });
});
