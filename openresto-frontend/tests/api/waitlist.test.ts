import {
  actOnWaitlistEntry,
  addWaitlistParty,
  getWaitlistBoard,
  getWaitlistQuote,
  getWaitlistStatus,
  joinWaitlist,
  leaveWaitlist,
} from "@/api/waitlist";

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

describe("getWaitlistQuote", () => {
  it("asks for the wait a party of the given size would face", async () => {
    mockFetch.mockResolvedValue(json({ acceptingGuests: true }));

    await expect(getWaitlistQuote(3, 4)).resolves.toEqual({ acceptingGuests: true });
    expect(mockFetch.mock.calls[0][0]).toBe("/api/restaurants/3/waitlist?seats=4");
  });

  it("is null on a failed answer or a failed request", async () => {
    mockFetch.mockResolvedValueOnce(json({}, 500));
    await expect(getWaitlistQuote(3, 2)).resolves.toBeNull();
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    await expect(getWaitlistQuote(3, 2)).resolves.toBeNull();
  });
});

describe("joinWaitlist", () => {
  it("posts the party and hands back the entry", async () => {
    mockFetch.mockResolvedValue(json({ ref: "abc" }, 201));

    const result = await joinWaitlist(3, { name: "Ada", seats: 2, locale: "fr" });

    expect(result).toEqual({ ok: true, value: { ref: "abc" } });
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/restaurants/3/waitlist");
    expect(JSON.parse(init.body)).toEqual({ name: "Ada", seats: 2, locale: "fr" });
  });

  it("carries the server's reason for a refusal, in the viewer's language", async () => {
    mockFetch.mockResolvedValue(json({ message: "closed", code: "waitlist.closed_now" }, 409));

    await expect(joinWaitlist(3, { name: "Ada", seats: 2 })).resolves.toEqual({
      ok: false,
      message: "This location is closed right now.",
    });
  });

  it("falls back to a generic message when the request fails", async () => {
    mockFetch.mockRejectedValue(new Error("offline"));

    const result = await joinWaitlist(3, { name: "Ada", seats: 2 });

    expect(result.ok).toBe(false);
  });
});

describe("getWaitlistStatus", () => {
  it("escapes the ref and returns the entry", async () => {
    mockFetch.mockResolvedValue(json({ status: "waiting" }));

    await expect(getWaitlistStatus("a/b")).resolves.toEqual({ status: "waiting" });
    expect(mockFetch.mock.calls[0][0]).toBe("/api/waitlist/a%2Fb");
  });

  it("tells an unknown ref (null) from a failed request (undefined)", async () => {
    mockFetch.mockResolvedValueOnce(json({}, 404));
    await expect(getWaitlistStatus("x")).resolves.toBeNull();
    mockFetch.mockResolvedValueOnce(json({}, 500));
    await expect(getWaitlistStatus("x")).resolves.toBeUndefined();
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    await expect(getWaitlistStatus("x")).resolves.toBeUndefined();
  });
});

describe("leaveWaitlist", () => {
  it("reports whether the server took the guest off", async () => {
    mockFetch.mockResolvedValueOnce(json(null, 204));
    await expect(leaveWaitlist("abc")).resolves.toBe(true);
    expect(mockFetch.mock.calls[0][0]).toBe("/api/waitlist/abc/leave");
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    await expect(leaveWaitlist("abc")).resolves.toBe(false);
  });
});

describe("getWaitlistBoard", () => {
  it("reads the location's board", async () => {
    mockFetch.mockResolvedValueOnce(json({ entries: [] }));
    await expect(getWaitlistBoard(3)).resolves.toEqual({ entries: [] });
    expect(mockFetch.mock.calls[0][0]).toBe("/api/admin/restaurants/3/waitlist");
  });

  it("is null when the board can't be read", async () => {
    mockFetch.mockResolvedValueOnce(json({}, 401));
    await expect(getWaitlistBoard(3)).resolves.toBeNull();
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    await expect(getWaitlistBoard(3)).resolves.toBeNull();
  });
});

describe("addWaitlistParty", () => {
  it("posts to the location's board", async () => {
    mockFetch.mockResolvedValueOnce(json({ id: 9 }, 201));
    await expect(addWaitlistParty(3, { name: "Bo", seats: 4 })).resolves.toEqual({
      ok: true,
      value: { id: 9 },
    });
    expect(mockFetch.mock.calls[0][0]).toBe("/api/admin/restaurants/3/waitlist");
  });

  it("reports a refusal or a failed request", async () => {
    mockFetch.mockResolvedValueOnce(json({ message: "Too big" }, 409));
    await expect(addWaitlistParty(3, { name: "Bo", seats: 40 })).resolves.toEqual({
      ok: false,
      message: "Too big",
    });
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect((await addWaitlistParty(3, { name: "Bo", seats: 4 })).ok).toBe(false);
  });
});

describe("actOnWaitlistEntry", () => {
  it("posts the action, with an empty body only for seat", async () => {
    mockFetch.mockResolvedValue(json(null, 204));

    await actOnWaitlistEntry(5, "seat");
    await actOnWaitlistEntry(5, "notify");

    expect(mockFetch.mock.calls[0][0]).toBe("/api/admin/waitlist/5/seat");
    expect(mockFetch.mock.calls[0][1].body).toBe("{}");
    expect(mockFetch.mock.calls[1][0]).toBe("/api/admin/waitlist/5/notify");
    expect(mockFetch.mock.calls[1][1].body).toBeUndefined();
  });

  it("reports a refusal or a failed request", async () => {
    mockFetch.mockResolvedValueOnce(
      json({ message: "No table", code: "waitlist.no_table_free" }, 409)
    );
    await expect(actOnWaitlistEntry(5, "seat")).resolves.toEqual({
      ok: false,
      message: "No free table can seat this party right now.",
    });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error("no body")),
    });
    expect((await actOnWaitlistEntry(5, "remove")).ok).toBe(false);
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect((await actOnWaitlistEntry(5, "remove")).ok).toBe(false);
  });
});
