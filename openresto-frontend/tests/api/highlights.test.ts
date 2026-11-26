import { fetchHighlights } from "@/api/highlights";

jest.unmock("@/api/highlights");

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  jest.spyOn(console, "error").mockImplementation();
});

describe("fetchHighlights", () => {
  it("fetches GET /api/highlights and returns array", async () => {
    const highlights = [
      { id: 1, title: "Great Food", body: "Fresh", iconKey: "star-outline", sortOrder: 0 },
    ];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => highlights });

    const result = await fetchHighlights();

    expect(result).toEqual(highlights);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/highlights");
  });

  it("returns empty array on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await fetchHighlights()).toEqual([]);
  });

  it("returns empty array on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await fetchHighlights()).toEqual([]);
  });
});
