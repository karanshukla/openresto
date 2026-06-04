import {
  getAdminOverview,
  getAdminDashboardStats,
  getAdminBookings,
  getAdminBooking,
  adminCreateBooking,
  adminExtendBooking,
  adminDeleteBooking,
  adminPurgeBooking,
  adminCreateRestaurant,
  adminDeleteRestaurant,
  adminGetTables,
  adminGetRestaurants,
  adminGetSections,
  adminRestoreBooking,
  adminUpdateBookingFull,
  getEmailSettings,
  saveEmailSettings,
  testEmailConnection,
  saveBrandSettings,
  adminGetHighlights,
  adminCreateHighlight,
  adminUpdateHighlight,
  adminDeleteHighlight,
  adminLookupBookings,
  sendBookingEmail,
  pauseRestaurantBookings,
  unpauseRestaurantBookings,
  extendRestaurantBookings,
  getEmailFailures,
  uploadHeroImage,
  deleteHeroImage,
} from "@/api/admin";

// Admin API now uses credentials: "include" for cookie-based auth — no mock needed

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  jest.spyOn(console, "error").mockImplementation();
});

// ---------- Overview ----------

describe("getAdminOverview", () => {
  it("fetches GET /api/admin/overview and returns data", async () => {
    const overview = { totalRestaurants: 2, totalBookings: 10, todayBookings: 3, totalSeats: 40 };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => overview });

    const result = await getAdminOverview();

    expect(result).toEqual(overview);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/admin/overview");
    expect(mockFetch.mock.calls[0][1].credentials).toBe("include");
  });

  it("returns null on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await getAdminOverview()).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await getAdminOverview()).toBeNull();
  });
});

describe("getAdminDashboardStats", () => {
  it("combines overview and todayBookingsList into stats", async () => {
    const overview = {
      todayBookings: 5,
      totalSeats: 100,
      todayBookingsList: [
        {
          id: 1,
          date: "2026-06-15T19:00:00Z",
          customerEmail: "a@b.com",
          seats: 2,
          restaurantName: "R1",
        },
      ],
    };

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => overview });

    const result = await getAdminDashboardStats();

    expect(result).toEqual({
      todayCount: 5,
      activeHoldsCount: 0,
      pausedCount: 0,
      totalCovers: 100,
      occupancyData: [],
      recentBookings: [
        {
          id: 1,
          date: "2026-06-15T19:00:00Z",
          endTime: undefined,
          customerEmail: "a@b.com",
          seats: 2,
          restaurantName: "R1",
          bookingRef: "",
          isCancelled: undefined,
        },
      ],
    });
  });

  it("returns null if overview fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const result = await getAdminDashboardStats();
    expect(result).toBeNull();
  });

  it("makes only one fetch call (no separate bookings request)", async () => {
    const overview = { todayBookings: 1, totalSeats: 10, todayBookingsList: [] };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => overview });

    await getAdminDashboardStats();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("includes cancelled bookings from todayBookingsList with isCancelled flag", async () => {
    const overview = {
      todayBookings: 2,
      totalSeats: 10,
      todayBookingsList: [
        {
          id: 1,
          date: "2026-05-12T12:00:00Z",
          customerEmail: "active@test.com",
          seats: 2,
          restaurantName: "R1",
          isCancelled: false,
        },
        {
          id: 2,
          date: "2026-05-12T14:00:00Z",
          customerEmail: "cancelled@test.com",
          seats: 3,
          restaurantName: "R1",
          isCancelled: true,
        },
      ],
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => overview });

    const result = await getAdminDashboardStats();

    expect(result?.recentBookings).toHaveLength(2);
    expect(result?.recentBookings[0].isCancelled).toBe(false);
    expect(result?.recentBookings[1].isCancelled).toBe(true);
  });
});

// ---------- Bookings ----------

describe("getAdminBookings", () => {
  it("fetches bookings with no optional params", async () => {
    const bookings = [{ id: 1 }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => bookings });

    const result = await getAdminBookings();

    expect(result).toEqual(bookings);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/admin/bookings");
    expect(url).not.toContain("?");
  });

  it("appends restaurantId and date query params", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });

    await getAdminBookings(5, "2026-03-23");

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("restaurantId=5");
    expect(url).toContain("date=2026-03-23");
  });

  it("appends status param only when not active", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });

    await getAdminBookings(1, undefined, "cancelled");

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("status=cancelled");
  });

  it("returns empty array on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await getAdminBookings()).toEqual([]);
  });

  it("returns empty array on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await getAdminBookings()).toEqual([]);
  });
});

describe("getAdminBooking", () => {
  it("fetches a single booking by id", async () => {
    const booking = { id: 7, customerEmail: "a@b.com" };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => booking });

    const result = await getAdminBooking(7);

    expect(result).toEqual(booking);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/admin/bookings/7");
  });

  it("returns null on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await getAdminBooking(999)).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await getAdminBooking(1)).toBeNull();
  });
});

describe("adminCreateBooking", () => {
  const req = {
    restaurantId: 1,
    sectionId: 2,
    tableId: 3,
    date: "2026-06-15T19:00:00Z",
    customerEmail: "c@d.com",
    seats: 4,
  };

  it("posts to /api/admin/bookings and returns created booking", async () => {
    const created = { ...req, id: 42 };
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => created });

    const result = await adminCreateBooking(req);

    expect(result).toEqual(created);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/bookings");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual(req);
  });

  it("throws with server message on 409 conflict", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ message: "Already booked" }),
    });

    await expect(adminCreateBooking(req)).rejects.toThrow("Already booked");
  });

  it("throws generic message on 409 without json body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => {
        throw new Error("no json");
      },
    });

    await expect(adminCreateBooking(req)).rejects.toThrow(
      "This table is already booked on that date."
    );
  });

  it("throws on non-ok non-409 response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(adminCreateBooking(req)).rejects.toThrow("Failed to create booking");
  });
});

describe("adminExtendBooking", () => {
  it("posts extend request and returns endTime", async () => {
    const data = { endTime: "2026-06-15T21:00:00Z" };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => data });

    const result = await adminExtendBooking(5, 30);

    expect(result).toEqual(data);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/bookings/5/extend");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ minutes: 30 });
  });

  it("returns null on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await adminExtendBooking(5, 30)).toBeNull();
  });
});

describe("adminDeleteBooking", () => {
  it("posts to cancel endpoint and returns true on success", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const result = await adminDeleteBooking(10);

    expect(result).toBe(true);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/bookings/10/cancel");
    expect(opts.method).toBe("POST");
  });

  it("returns false on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await adminDeleteBooking(10)).toBe(false);
  });

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await adminDeleteBooking(10)).toBe(false);
  });
});

describe("adminPurgeBooking", () => {
  it("sends DELETE to booking endpoint and returns true", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const result = await adminPurgeBooking(10);

    expect(result).toBe(true);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/admin/bookings/10");
    expect(mockFetch.mock.calls[0][0]).not.toContain("/purge");
    expect(mockFetch.mock.calls[0][1].method).toBe("DELETE");
  });

  it("returns false on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await adminPurgeBooking(10)).toBe(false);
  });

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await adminPurgeBooking(10)).toBe(false);
  });
});

// ---------- Restaurants ----------

describe("adminCreateRestaurant", () => {
  it("posts to /api/admin/restaurants and returns data", async () => {
    const created = { id: 1, name: "Test Bistro" };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => created });

    const result = await adminCreateRestaurant({ name: "Test Bistro" });

    expect(result).toEqual(created);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/restaurants");
    expect(opts.method).toBe("POST");
  });

  it("returns null on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await adminCreateRestaurant({ name: "Fail" })).toBeNull();
  });
});

describe("adminDeleteRestaurant", () => {
  it("sends DELETE and returns true on success", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    expect(await adminDeleteRestaurant(3)).toBe(true);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/admin/restaurants/3");
    expect(mockFetch.mock.calls[0][1].method).toBe("DELETE");
  });

  it("returns false on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await adminDeleteRestaurant(3)).toBe(false);
  });
});

// ---------- Tables ----------

describe("adminGetTables", () => {
  it("fetches tables for a restaurant", async () => {
    const sections = [{ id: 1, name: "Main", tables: [{ id: 1, name: "T1", seats: 4 }] }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => sections });

    const result = await adminGetTables(2);

    expect(result).toEqual(sections);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/admin/restaurants/2/tables");
  });

  it("returns empty array on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await adminGetTables(2)).toEqual([]);
  });

  it("returns empty array on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await adminGetTables(2)).toEqual([]);
  });
});

// ---------- Email Settings ----------

describe("getEmailSettings", () => {
  it("fetches email settings", async () => {
    const settings = {
      host: "smtp.test.com",
      port: 587,
      username: "user",
      password: "pass",
      enableSsl: true,
      isConfigured: true,
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => settings });

    const result = await getEmailSettings();

    expect(result).toEqual(settings);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/admin/email-settings");
  });

  it("returns defaults on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await getEmailSettings();

    expect(result).toEqual({
      host: "",
      port: 587,
      username: "",
      password: "",
      enableSsl: true,
      isConfigured: false,
      sendBookingConfirmations: false,
    });
  });
});

describe("saveEmailSettings", () => {
  const data = {
    host: "smtp.test.com",
    port: 587,
    username: "user",
    password: "pass",
    enableSsl: true,
    sendBookingConfirmations: false,
  };

  it("patches email settings and returns response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: "Saved" }) });

    const result = await saveEmailSettings(data);

    expect(result).toEqual({ message: "Saved" });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/email-settings");
    expect(opts.method).toBe("PATCH");
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await saveEmailSettings(data)).toBeNull();
  });
});

describe("testEmailConnection", () => {
  it("returns ok true with message on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Connection OK" }),
    });

    const result = await testEmailConnection();

    expect(result).toEqual({ ok: true, message: "Connection OK" });
    expect(mockFetch.mock.calls[0][0]).toContain("/api/admin/email-settings/test");
    expect(mockFetch.mock.calls[0][1].method).toBe("POST");
  });

  it("returns ok false with message on server failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "SMTP unreachable" }),
    });

    const result = await testEmailConnection();
    expect(result).toEqual({ ok: false, message: "SMTP unreachable" });
  });

  it("returns network error on exception", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));

    const result = await testEmailConnection();
    expect(result).toEqual({ ok: false, message: "Network error." });
  });
});

describe("adminRestoreBooking", () => {
  it("posts to restore endpoint and returns true", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const result = await adminRestoreBooking(5);
    expect(result).toBe(true);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/admin/bookings/5/restore");
  });

  it("throws error with server message on failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Cannot restore past booking" }),
    });
    await expect(adminRestoreBooking(5)).rejects.toThrow("Cannot restore past booking");
  });

  it("throws generic error when JSON fails on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => {
        throw new Error("no json");
      },
    });
    await expect(adminRestoreBooking(5)).rejects.toThrow("Failed to restore booking");
  });
});

describe("adminUpdateBookingFull", () => {
  const req = { seats: 10 };

  it("puts to booking endpoint and returns updated data", async () => {
    const updated = { id: 5, seats: 10 };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => updated });
    const result = await adminUpdateBookingFull(5, req);
    expect(result).toEqual(updated);
    expect(mockFetch.mock.calls[0][1].method).toBe("PUT");
  });

  it("throws error on failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Table too small" }),
    });
    await expect(adminUpdateBookingFull(5, req)).rejects.toThrow("Table too small");
  });

  it("throws generic error when JSON fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => {
        throw new Error();
      },
    });
    await expect(adminUpdateBookingFull(5, req)).rejects.toThrow("Failed to update booking");
  });
});

describe("adminGetRestaurants", () => {
  it("fetches restaurants list", async () => {
    const list = [{ id: 1, name: "R1" }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => list });
    const result = await adminGetRestaurants();
    expect(result).toEqual(list);
  });

  it("returns empty array on error", async () => {
    mockFetch.mockRejectedValueOnce(new Error());
    expect(await adminGetRestaurants()).toEqual([]);
  });
});

describe("adminGetSections", () => {
  it("fetches sections for restaurant", async () => {
    const list = [{ id: 1, name: "S1" }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => list });
    const result = await adminGetSections(2);
    expect(result).toEqual(list);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/admin/restaurants/2/sections");
  });

  it("returns empty array on error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await adminGetSections(2)).toEqual([]);
  });
});
describe("brand settings", () => {
  const brandData = { appName: "My Resto", primaryColor: "#ff0000" };

  it("patches brand settings and returns response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ message: "Saved" }) });

    const result = await saveBrandSettings(brandData);

    expect(result).toEqual({ message: "Saved" });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/brand");
    expect(opts.method).toBe("PATCH");
    expect(JSON.parse(opts.body)).toEqual(brandData);
  });

  it("returns error message on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Invalid color" }),
    });

    const result = await saveBrandSettings(brandData);
    expect(result).toEqual({ message: "Invalid color" });
  });

  it("returns fallback message when json fails on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => {
        throw new Error("no json");
      },
    });

    const result = await saveBrandSettings(brandData);
    expect(result).toEqual({ message: "Failed to save." });
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await saveBrandSettings(brandData)).toBeNull();
  });
});

// ---------- Highlights ----------

describe("adminGetHighlights", () => {
  it("returns parsed highlights on success", async () => {
    const mockHighlights = [
      {
        id: 1,
        title: "Wood-fired kitchen",
        body: "Fresh daily.",
        iconKey: "flame-outline",
        sortOrder: 0,
      },
    ];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => mockHighlights });
    const result = await adminGetHighlights();
    expect(result).toEqual(mockHighlights);
  });

  it("returns empty array on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const result = await adminGetHighlights();
    expect(result).toEqual([]);
  });

  it("returns empty array on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network"));
    const result = await adminGetHighlights();
    expect(result).toEqual([]);
  });
});

describe("adminCreateHighlight", () => {
  const req = { title: "Test", body: "Body", iconKey: "star-outline", sortOrder: 0 };

  it("returns created highlight on success", async () => {
    const created = { id: 5, ...req };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => created });
    const result = await adminCreateHighlight(req);
    expect(result).toEqual(created);
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network"));
    const result = await adminCreateHighlight(req);
    expect(result).toBeNull();
  });
});

describe("adminUpdateHighlight", () => {
  const req = { title: "Updated", body: "New body", iconKey: "heart-outline", sortOrder: 1 };

  it("returns updated highlight on success", async () => {
    const updated = { id: 3, ...req };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => updated });
    const result = await adminUpdateHighlight(3, req);
    expect(result).toEqual(updated);
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network"));
    const result = await adminUpdateHighlight(3, req);
    expect(result).toBeNull();
  });
});

describe("adminDeleteHighlight", () => {
  it("returns true when delete succeeds", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const result = await adminDeleteHighlight(1);
    expect(result).toBe(true);
  });

  it("returns false when delete fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const result = await adminDeleteHighlight(1);
    expect(result).toBe(false);
  });

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network"));
    const result = await adminDeleteHighlight(1);
    expect(result).toBe(false);
  });
});

// ---------- Lookup / new booking helpers ----------

describe("adminLookupBookings", () => {
  it("passes email param when query contains @", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });

    await adminLookupBookings("user@example.com");

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("email=user%40example.com");
    expect(url).not.toContain("bookingRef=");
    expect(url).toContain("status=all");
  });

  it("passes bookingRef param when query does not contain @", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });

    await adminLookupBookings("REF123");

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("bookingRef=REF123");
    expect(url).not.toContain("email=");
    expect(url).toContain("status=all");
  });

  it("returns empty array on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await adminLookupBookings("REF999")).toEqual([]);
  });
});

describe("sendBookingEmail", () => {
  it("posts to /admin/bookings/{id}/email and returns ok + message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Email sent" }),
    });

    const result = await sendBookingEmail(7, "Subject", "Body text");

    expect(result).toEqual({ ok: true, message: "Email sent" });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/bookings/7/email");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ subject: "Subject", body: "Body text" });
  });

  it("returns ok false with server message on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Delivery failed" }),
    });

    const result = await sendBookingEmail(7, "Subject", "Body");
    expect(result).toEqual({ ok: false, message: "Delivery failed" });
  });

  it("returns ok false with network error message on exception", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));

    const result = await sendBookingEmail(7, "Subject", "Body");
    expect(result).toEqual({ ok: false, message: "Network error." });
  });
});

describe("pauseRestaurantBookings", () => {
  it("posts to /admin/restaurants/{id}/pause and returns true on success", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const result = await pauseRestaurantBookings(3, 30);

    expect(result).toBe(true);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/restaurants/3/pause");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ minutes: 30 });
  });

  it("returns false on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await pauseRestaurantBookings(3, 30)).toBe(false);
  });

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await pauseRestaurantBookings(3, 30)).toBe(false);
  });
});

describe("unpauseRestaurantBookings", () => {
  it("posts to /admin/restaurants/{id}/unpause and returns true on success", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const result = await unpauseRestaurantBookings(3);

    expect(result).toBe(true);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/restaurants/3/unpause");
    expect(opts.method).toBe("POST");
  });

  it("returns false on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await unpauseRestaurantBookings(3)).toBe(false);
  });

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await unpauseRestaurantBookings(3)).toBe(false);
  });
});

describe("extendRestaurantBookings", () => {
  it("posts to /admin/restaurants/{id}/extend and returns ok with extendedBookings", async () => {
    const bookings = [{ id: 1 }, { id: 2 }];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ extendedBookings: bookings }),
    });

    const result = await extendRestaurantBookings(4, 15);

    expect(result).toEqual({ ok: true, extendedBookings: bookings });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/restaurants/4/extend");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ minutes: 15 });
  });

  it("returns ok false with empty array on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await extendRestaurantBookings(4, 15);
    expect(result).toEqual({ ok: false, extendedBookings: [] });
  });

  it("returns ok false with empty array on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));

    const result = await extendRestaurantBookings(4, 15);
    expect(result).toEqual({ ok: false, extendedBookings: [] });
  });
});

describe("getEmailFailures", () => {
  it("fetches GET /admin/email-settings/failures and returns array", async () => {
    const failures = [
      {
        id: 1,
        bookingRef: "REF001",
        recipientEmail: "a@b.com",
        errorMessage: "SMTP timeout",
        attemptedAt: "2026-05-01T10:00:00Z",
      },
    ];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => failures });

    const result = await getEmailFailures();

    expect(result).toEqual(failures);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/admin/email-settings/failures");
  });

  it("returns empty array on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await getEmailFailures()).toEqual([]);
  });

  it("returns empty array on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await getEmailFailures()).toEqual([]);
  });
});

describe("uploadHeroImage", () => {
  it("posts multipart to /api/media/hero and returns url on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: "https://cdn.example.com/hero.jpg" }),
    });

    const file = new File(["img"], "hero.jpg", { type: "image/jpeg" });
    const result = await uploadHeroImage(file);

    expect(result).toBe("https://cdn.example.com/hero.jpg");
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/media/hero");
    expect(opts.method).toBe("POST");
    expect(opts.credentials).toBe("include");
  });

  it("returns null on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const file = new File(["img"], "hero.jpg", { type: "image/jpeg" });
    expect(await uploadHeroImage(file)).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    const file = new File(["img"], "hero.jpg", { type: "image/jpeg" });
    expect(await uploadHeroImage(file)).toBeNull();
  });
});

describe("deleteHeroImage", () => {
  it("sends DELETE to /api/media/hero", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await deleteHeroImage();

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/media/hero");
    expect(opts.method).toBe("DELETE");
    expect(opts.credentials).toBe("include");
  });

  it("resolves without throwing on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    await expect(deleteHeroImage()).resolves.toBeUndefined();
  });

  it("resolves without throwing on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    await expect(deleteHeroImage()).resolves.toBeUndefined();
  });
});
