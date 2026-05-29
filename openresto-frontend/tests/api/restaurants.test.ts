import {
  createRestaurant,
  fetchRestaurants,
  fetchRestaurantById,
  fetchHighlights,
  updateRestaurant,
  addSection,
  updateSection,
  deleteSection,
  addTable,
  updateTable,
  deleteTable,
  uploadLocationImage,
  deleteLocationImage,
} from "@/api/restaurants";

// Restaurants API now uses credentials: "include" for cookie-based auth

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  jest.spyOn(console, "error").mockImplementation();
});

// ---------- Fetch restaurants ----------

describe("fetchRestaurants", () => {
  it("fetches GET /api/restaurants and returns array", async () => {
    const restaurants = [{ id: 1, name: "Bistro", sections: [] }];
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => restaurants });

    const result = await fetchRestaurants();

    expect(result).toEqual(restaurants);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/restaurants");
  });

  it("returns empty array on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await fetchRestaurants()).toEqual([]);
  });

  it("returns empty array on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await fetchRestaurants()).toEqual([]);
  });
});

describe("fetchRestaurantById", () => {
  it("fetches a single restaurant by id", async () => {
    const restaurant = { id: 5, name: "Cafe", sections: [] };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => restaurant });

    const result = await fetchRestaurantById(5);

    expect(result).toEqual(restaurant);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/restaurants/5");
  });

  it("returns null on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await fetchRestaurantById(999)).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await fetchRestaurantById(1)).toBeNull();
  });
});

// ---------- Update restaurant ----------

describe("updateRestaurant", () => {
  const data = { name: "Updated Bistro", address: "123 Main St" };

  it("puts to /api/restaurants/:id with auth headers", async () => {
    const updated = { id: 1, ...data, sections: [] };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => updated });

    const result = await updateRestaurant(1, data);

    expect(result).toEqual(updated);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/restaurants/1");
    expect(opts.method).toBe("PUT");
    expect(opts.credentials).toBe("include");
    expect(JSON.parse(opts.body)).toEqual(data);
  });

  it("returns null on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await updateRestaurant(1, data)).toBeNull();
  });
});

// ---------- Section management ----------

describe("addSection", () => {
  it("posts new section with auth headers", async () => {
    const section = { id: 10, name: "Patio", tables: [] };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => section });

    const result = await addSection(1, "Patio");

    expect(result).toEqual(section);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/restaurants/1/sections");
    expect(opts.method).toBe("POST");
    expect(opts.credentials).toBe("include");
    expect(JSON.parse(opts.body)).toEqual({ name: "Patio" });
  });

  it("returns null on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await addSection(1, "Fail")).toBeNull();
  });
});

describe("updateSection", () => {
  it("puts to section endpoint with auth", async () => {
    const section = { id: 10, name: "Terrace", tables: [] };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => section });

    const result = await updateSection(1, 10, "Terrace");

    expect(result).toEqual(section);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/restaurants/1/sections/10");
    expect(opts.method).toBe("PUT");
    expect(JSON.parse(opts.body)).toEqual({ name: "Terrace" });
  });

  it("returns null on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await updateSection(1, 10, "Fail")).toBeNull();
  });
});

describe("deleteSection", () => {
  it("sends DELETE and returns true on success", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const result = await deleteSection(1, 10);

    expect(result).toBe(true);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/restaurants/1/sections/10");
    expect(opts.method).toBe("DELETE");
    expect(opts.credentials).toBe("include");
  });

  it("returns false on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await deleteSection(1, 10)).toBe(false);
  });

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await deleteSection(1, 10)).toBe(false);
  });
});

// ---------- Table management ----------

describe("addTable", () => {
  it("posts new table with auth headers", async () => {
    const table = { id: 20, name: "T1", seats: 4 };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => table });

    const result = await addTable(1, 10, { name: "T1", seats: 4 });

    expect(result).toEqual(table);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/restaurants/1/sections/10/tables");
    expect(opts.method).toBe("POST");
    expect(opts.credentials).toBe("include");
  });

  it("returns null on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await addTable(1, 10, { seats: 2 })).toBeNull();
  });
});

describe("updateTable", () => {
  it("puts to table endpoint with auth", async () => {
    const table = { id: 20, name: "T1-updated", seats: 6 };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => table });

    const result = await updateTable(1, 10, 20, { name: "T1-updated", seats: 6 });

    expect(result).toEqual(table);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/restaurants/1/sections/10/tables/20");
    expect(opts.method).toBe("PUT");
  });

  it("returns null on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await updateTable(1, 10, 20, { seats: 2 })).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await updateTable(1, 10, 20, { seats: 2 })).toBeNull();
  });
});

describe("deleteTable", () => {
  it("sends DELETE and returns true on success", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const result = await deleteTable(1, 10, 20);

    expect(result).toBe(true);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/restaurants/1/sections/10/tables/20");
    expect(opts.method).toBe("DELETE");
  });

  it("returns false on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await deleteTable(1, 10, 20)).toBe(false);
  });

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await deleteTable(1, 10, 20)).toBe(false);
  });
});

// ---------- createRestaurant ----------

describe("createRestaurant", () => {
  it("posts to /api/restaurants and returns created restaurant", async () => {
    const created = { id: 10, name: "New Place", sections: [] };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => created });

    const result = await createRestaurant("New Place");

    expect(result).toEqual(created);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/restaurants");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toMatchObject({ name: "New Place" });
  });

  it("returns null on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await createRestaurant("Fail")).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await createRestaurant("Fail")).toBeNull();
  });
});

// ---------- fetchHighlights ----------

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

// ---------- uploadLocationImage ----------

describe("uploadLocationImage", () => {
  it("posts form data and returns url on success", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ url: "/uploads/img.png" }) });

    const file = new File(["content"], "img.png", { type: "image/png" });
    const result = await uploadLocationImage(1, file);

    expect(result).toBe("/uploads/img.png");
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/media/location/1");
    expect(opts.method).toBe("POST");
  });

  it("returns null when response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const file = new File(["x"], "x.png");
    expect(await uploadLocationImage(1, file)).toBeNull();
  });

  it("returns null when url missing from response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const file = new File(["x"], "x.png");
    expect(await uploadLocationImage(1, file)).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    const file = new File(["x"], "x.png");
    expect(await uploadLocationImage(1, file)).toBeNull();
  });
});

// ---------- deleteLocationImage ----------

describe("deleteLocationImage", () => {
  it("sends DELETE to media endpoint", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await deleteLocationImage(1);

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/media/location/1");
    expect(opts.method).toBe("DELETE");
  });

  it("silently ignores network errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    await expect(deleteLocationImage(1)).resolves.toBeUndefined();
  });
});
