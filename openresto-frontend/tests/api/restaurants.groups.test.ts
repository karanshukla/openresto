import {
  fetchSocialLinks,
  createTableGroup,
  updateTableGroup,
  deleteTableGroup,
  fetchTableDeleteImpact,
  fetchSectionDeleteImpact,
  fetchScheduleConflicts,
} from "@/api/restaurants";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  // mockClear as well as re-spying: jest.spyOn returns the existing mock on the second call, so
  // without this the call history accumulates across tests and the "does not log" assertion below
  // sees every earlier suite's errors.
  jest.spyOn(console, "error").mockImplementation().mockClear();
});

// ---------- Social links ----------

describe("fetchSocialLinks", () => {
  it("returns the links when the response is ok", async () => {
    const links = [
      {
        id: 1,
        label: "Instagram",
        url: "https://ig.test",
        iconKey: "logo-instagram",
        sortOrder: 0,
      },
    ];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => links });

    expect(await fetchSocialLinks()).toEqual(links);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/social-links");
  });

  it("returns an empty list on a non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await fetchSocialLinks()).toEqual([]);
  });

  it("returns an empty list on a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await fetchSocialLinks()).toEqual([]);
  });
});

// ---------- Combinable table groups (#273) ----------

const group = {
  id: 3,
  name: "Window booths",
  combinedSeats: 8,
  members: [
    { id: 1, name: "T1", seats: 4 },
    { id: 2, name: "T2", seats: 4 },
  ],
};

describe("createTableGroup", () => {
  it("posts the group and returns it", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => group });

    const result = await createTableGroup(1, {
      name: "Window booths",
      members: [1, 2],
      combinedSeats: 8,
    });

    expect(result).toEqual(group);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/restaurants/1/groups");
    expect(opts.method).toBe("POST");
    expect(opts.credentials).toBe("include");
    expect(JSON.parse(opts.body)).toEqual({
      name: "Window booths",
      members: [1, 2],
      combinedSeats: 8,
    });
  });

  it("returns null on a non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await createTableGroup(1, { members: [1, 2], combinedSeats: 8 })).toBeNull();
  });

  it("returns null on a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await createTableGroup(1, { members: [1, 2], combinedSeats: 8 })).toBeNull();
  });
});

describe("updateTableGroup", () => {
  it("puts to the group endpoint and returns the updated group", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => group });

    const result = await updateTableGroup(1, 3, {
      name: "Renamed",
      members: [1, 2],
      combinedSeats: 7,
    });

    expect(result).toEqual(group);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/restaurants/1/groups/3");
    expect(opts.method).toBe("PUT");
    expect(JSON.parse(opts.body)).toEqual({ name: "Renamed", members: [1, 2], combinedSeats: 7 });
  });

  it("returns null on a non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await updateTableGroup(1, 3, { members: [1, 2], combinedSeats: 7 })).toBeNull();
  });

  it("returns null on a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await updateTableGroup(1, 3, { members: [1, 2], combinedSeats: 7 })).toBeNull();
  });
});

describe("deleteTableGroup", () => {
  it("sends DELETE and returns true on success", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    expect(await deleteTableGroup(1, 3)).toBe(true);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/restaurants/1/groups/3");
    expect(opts.method).toBe("DELETE");
    expect(opts.credentials).toBe("include");
  });

  it("returns false on a non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await deleteTableGroup(1, 3)).toBe(false);
  });

  it("returns false on a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await deleteTableGroup(1, 3)).toBe(false);
  });
});

// ---------- Delete-impact previews (#270) ----------
//
// The count is best-effort friction for the two-step delete UI, never a gate — every failure
// mode must resolve to null so the UI degrades to generic copy instead of blocking the delete.

describe("fetchTableDeleteImpact", () => {
  it("returns the impact when the response is ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ bookings: 4 }) });

    expect(await fetchTableDeleteImpact(1, 2, 3)).toEqual({ bookings: 4 });
    expect(mockFetch.mock.calls[0][0]).toContain("/api/restaurants/1/sections/2/tables/3/impact");
  });

  it("returns null on a non-ok response without logging", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await fetchTableDeleteImpact(1, 2, 3)).toBeNull();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("returns null on a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await fetchTableDeleteImpact(1, 2, 3)).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});

describe("fetchSectionDeleteImpact", () => {
  it("returns the impact when the response is ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ bookings: 2 }) });

    expect(await fetchSectionDeleteImpact(1, 2)).toEqual({ bookings: 2 });
    expect(mockFetch.mock.calls[0][0]).toContain("/api/restaurants/1/sections/2/impact");
  });

  it("returns null on a non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await fetchSectionDeleteImpact(1, 2)).toBeNull();
  });

  it("returns null on a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await fetchSectionDeleteImpact(1, 2)).toBeNull();
  });
});

describe("fetchScheduleConflicts", () => {
  const conflict = {
    bookingId: 7,
    bookingRef: "crispy-basil-truffle",
    customerName: "Ada",
    date: "2026-09-02T10:00:00Z",
    seats: 2,
    reason: "outsideHours",
  };

  it("returns the conflicts when the response is ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [conflict] });

    expect(await fetchScheduleConflicts(1)).toEqual([conflict]);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/restaurants/1/schedule-conflicts");
  });

  // Null, not [] — the caller renders nothing for null and would otherwise announce all-clear.
  it("returns null on a non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await fetchScheduleConflicts(1)).toBeNull();
  });

  it("returns null on a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await fetchScheduleConflicts(1)).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});
