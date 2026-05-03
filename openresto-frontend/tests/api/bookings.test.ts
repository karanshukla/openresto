import {
  createBooking,
  getBookingById,
  getBookingByRef,
  getBookingsByRestaurant,
  deleteBooking,
} from "@/api/bookings";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("createBooking", () => {
  const validBooking = {
    restaurantId: 1,
    tableId: 2,
    sectionId: 1,
    customerEmail: "test@example.com",
    seats: 4,
    date: "2026-06-15T19:00:00Z",
  };

  it("posts to /api/bookings and returns the created booking", async () => {
    const created = { ...validBooking, id: 42, isHeld: false, bookingRef: "crispy-basil" };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => created,
    });

    const result = await createBooking(validBooking);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/bookings");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual(validBooking);
    expect(result).toEqual(created);
  });

  it("throws with server message on 409 conflict", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ message: "Table already booked" }),
    });

    await expect(createBooking(validBooking)).rejects.toThrow("Table already booked");
  });

  it("throws generic message on 409 without body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => {
        throw new Error("no json");
      },
    });

    await expect(createBooking(validBooking)).rejects.toThrow("This table is no longer available.");
  });

  it("throws on non-ok non-409 response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(createBooking(validBooking)).rejects.toThrow("Failed to create booking");
  });
});

describe("getBookingById", () => {
  it("fetches and returns booking by id", async () => {
    const booking = { id: 5, customerEmail: "a@b.com", seats: 2 };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => booking,
    });

    const result = await getBookingById(5);
    expect(result).toMatchObject(booking);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/bookings/5");
  });

  it("returns null on error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await getBookingById(999);
    expect(result).toBeNull();
  });

  it("returns null on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await getBookingById(1);
    expect(result).toBeNull();
  });
});

describe("getBookingByRef", () => {
  it("fetches by ref and email", async () => {
    const booking = { id: 3, bookingRef: "sunny-pepper", customerEmail: "u@x.com" };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => booking,
    });

    const result = await getBookingByRef("sunny-pepper", "u@x.com");
    expect(result).toMatchObject(booking);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/bookings/ref/sunny-pepper");
    expect(url).toContain("email=u%40x.com");
  });

  it("returns null on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await getBookingByRef("no-exist", "a@b.com")).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await getBookingByRef("ref", "a@b.com")).toBeNull();
  });
});

describe("getBookingsByRestaurant", () => {
  it("fetches bookings for a restaurant", async () => {
    const bookings = [{ id: 1 }, { id: 2 }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => bookings });
    const result = await getBookingsByRestaurant(5);
    expect(result[0]).toMatchObject({ id: 1 });
    expect(result[1]).toMatchObject({ id: 2 });
    expect(mockFetch.mock.calls[0][0]).toContain("/api/bookings/restaurant/5");
  });

  it("returns empty array on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await getBookingsByRestaurant(5)).toEqual([]);
  });

  it("returns empty array on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await getBookingsByRestaurant(5)).toEqual([]);
  });
});

describe("deleteBooking", () => {
  it("sends DELETE and returns true on success", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const result = await deleteBooking(10);
    expect(result).toBe(true);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/bookings/10");
    expect(opts.method).toBe("DELETE");
  });

  it("returns false on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await deleteBooking(10)).toBe(false);
  });

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await deleteBooking(10)).toBe(false);
  });
});
