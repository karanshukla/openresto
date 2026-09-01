import { Platform } from "react-native";
import {
  fetchCachedBookings,
  rememberBooking,
  MAX_REMEMBERED_BOOKINGS,
  type CachedBooking,
} from "@/utils/bookingCache";
import { StorageService } from "@/services/storage";

const mockFetch = jest.fn();
global.fetch = mockFetch;

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });

const booking = (bookingRef: string, over: Partial<CachedBooking> = {}): CachedBooking => ({
  bookingRef,
  email: "a@b.com",
  date: "2026-06-15",
  seats: 2,
  createdAt: "2026-06-15",
  ...over,
});

beforeEach(() => {
  mockFetch.mockReset();
  jest.restoreAllMocks();
  setPlatform("web");
});

describe("fetchCachedBookings (web — the HttpOnly cookie is the store)", () => {
  it("fetches from /api/bookings/my-recent with credentials", async () => {
    const cached = [booking("crispy-basil")];
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

describe("rememberBooking / fetchCachedBookings (native — no cookie jar)", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    setPlatform("ios");
    store = {};
    jest.spyOn(StorageService, "getItem").mockImplementation((k) => store[k] ?? null);
    jest.spyOn(StorageService, "setItem").mockImplementation((k, v) => {
      store[k] = v;
    });
  });

  it("reads back a booking it just remembered, without hitting the network", async () => {
    rememberBooking(booking("crispy-basil", { restaurantName: "Test Bistro" }));

    await expect(fetchCachedBookings()).resolves.toEqual([
      booking("crispy-basil", { restaurantName: "Test Bistro" }),
    ]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("puts the newest booking first", async () => {
    rememberBooking(booking("older"));
    rememberBooking(booking("newer"));

    const refs = (await fetchCachedBookings()).map((b) => b.bookingRef);
    expect(refs).toEqual(["newer", "older"]);
  });

  it("de-dupes by booking reference rather than stacking a second copy", async () => {
    rememberBooking(booking("crispy-basil", { seats: 2 }));
    rememberBooking(booking("other"));
    rememberBooking(booking("crispy-basil", { seats: 6 }));

    const list = await fetchCachedBookings();
    expect(list.map((b) => b.bookingRef)).toEqual(["crispy-basil", "other"]);
    expect(list[0].seats).toBe(6);
  });

  it(`keeps ${MAX_REMEMBERED_BOOKINGS} bookings and drops the oldest beyond that`, async () => {
    for (let i = 0; i <= MAX_REMEMBERED_BOOKINGS; i++) rememberBooking(booking(`ref-${i}`));

    const list = await fetchCachedBookings();
    expect(list).toHaveLength(MAX_REMEMBERED_BOOKINGS);
    expect(list[0].bookingRef).toBe(`ref-${MAX_REMEMBERED_BOOKINGS}`);
    expect(list.map((b) => b.bookingRef)).not.toContain("ref-0");
  });

  it("returns an empty list when nothing has been remembered", async () => {
    await expect(fetchCachedBookings()).resolves.toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt", async () => {
    store["openresto.recentBookings"] = "{not json";
    await expect(fetchCachedBookings()).resolves.toEqual([]);
  });

  it("returns an empty list when the stored value is not an array", async () => {
    store["openresto.recentBookings"] = '{"bookingRef":"lonely"}';
    await expect(fetchCachedBookings()).resolves.toEqual([]);
  });
});

describe("rememberBooking (web)", () => {
  it("writes nothing — the cookie the API set stays the only web store", () => {
    const setItem = jest.spyOn(StorageService, "setItem");
    rememberBooking(booking("crispy-basil"));
    expect(setItem).not.toHaveBeenCalled();
  });
});
