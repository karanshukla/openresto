import { getTonight, moveBookingToTable, seatWaitlistEntryAt } from "@/api/tonight";

const mockFetch = jest.fn();
global.fetch = mockFetch;

const json = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
});

let consoleError: jest.SpyInstance;

beforeEach(() => {
  mockFetch.mockReset();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => consoleError.mockRestore());

const sent = (call = 0) => ({
  url: mockFetch.mock.calls[call][0],
  method: mockFetch.mock.calls[call][1]?.method,
  body: JSON.parse(mockFetch.mock.calls[call][1]?.body ?? "null"),
});

describe("getTonight", () => {
  it("reads the location's aggregate in one request", async () => {
    mockFetch.mockResolvedValue(json({ restaurantId: 3 }));

    await expect(getTonight(3)).resolves.toEqual({ restaurantId: 3 });
    expect(sent().url).toBe("/api/admin/restaurants/3/tonight");
  });

  it("is null on a failed answer or a failed request", async () => {
    mockFetch.mockResolvedValueOnce(json({}, 500));
    await expect(getTonight(3)).resolves.toBeNull();
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    await expect(getTonight(3)).resolves.toBeNull();
  });
});

describe("moveBookingToTable", () => {
  it("puts the new table on the booking", async () => {
    mockFetch.mockResolvedValue(json({ id: 8 }));

    await expect(moveBookingToTable(8, 4)).resolves.toEqual({ ok: true, value: null });
    expect(sent()).toEqual({ url: "/api/admin/bookings/8", method: "PUT", body: { tableId: 4 } });
  });

  it("carries the server's reason when the move is refused", async () => {
    mockFetch.mockResolvedValue(json({ message: "Taken.", code: "booking.move_conflict" }, 400));

    const result = await moveBookingToTable(8, 4);

    expect(result.ok).toBe(false);
  });

  it("still refuses when the refusal carries no readable body", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error("html")),
    });

    await expect(moveBookingToTable(8, 4)).resolves.toEqual({
      ok: false,
      message: "Couldn't move the booking to that table.",
    });
  });

  it("falls back to its own message when the request fails", async () => {
    mockFetch.mockRejectedValue(new Error("offline"));

    await expect(moveBookingToTable(8, 4)).resolves.toEqual({
      ok: false,
      message: "Couldn't move the booking to that table.",
    });
  });
});

describe("seatWaitlistEntryAt", () => {
  it("passes the chosen table through to the seat", async () => {
    mockFetch.mockResolvedValue(json({}));

    await expect(seatWaitlistEntryAt(5, { kind: "table", id: 4 })).resolves.toEqual({
      ok: true,
      value: null,
    });
    expect(sent()).toEqual({
      url: "/api/admin/waitlist/5/seat",
      method: "POST",
      body: { tableId: 4 },
    });
  });

  it("passes a chosen group as a group", async () => {
    mockFetch.mockResolvedValue(json({}));

    await seatWaitlistEntryAt(5, { kind: "group", id: 9 });

    expect(sent().body).toEqual({ tableGroupId: 9 });
  });

  it("carries a refusal, and falls back when the request fails", async () => {
    mockFetch.mockResolvedValueOnce(json({ code: "waitlist.no_table_free" }, 409));
    expect((await seatWaitlistEntryAt(5, { kind: "table", id: 4 })).ok).toBe(false);

    mockFetch.mockRejectedValueOnce(new Error("offline"));
    await expect(seatWaitlistEntryAt(5, { kind: "table", id: 4 })).resolves.toEqual({
      ok: false,
      message: "Couldn't seat the party there.",
    });
  });
});
