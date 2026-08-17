import { getAuditEntries } from "@/api/audit";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("getAuditEntries", () => {
  it("returns the page and forwards every filter", async () => {
    const data = { items: [], totalCount: 0, page: 2, pageSize: 10 };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => data });

    const result = await getAuditEntries({
      actorUserId: 3,
      action: "booking",
      targetType: "Booking",
      restaurantId: 1,
      from: "2026-08-01T00:00:00Z",
      to: "2026-08-17T00:00:00Z",
      page: 2,
      pageSize: 10,
    });

    expect(result).toEqual(data);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/admin/audit");
    expect(url).toContain("actorUserId=3");
    expect(url).toContain("action=booking");
    expect(url).toContain("targetType=Booking");
    expect(url).toContain("restaurantId=1");
    expect(url).toContain("from=");
    expect(url).toContain("to=");
    expect(url).toContain("page=2");
    expect(url).toContain("pageSize=10");
  });

  it("sends no query string when nothing is filtered", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) });
    await getAuditEntries({});
    const [url] = mockFetch.mock.calls[0];
    expect(url).not.toContain("?");
  });

  it("returns null when the request is refused", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    await expect(getAuditEntries({})).resolves.toBeNull();
  });

  it("returns null on a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));
    await expect(getAuditEntries({})).resolves.toBeNull();
  });
});
