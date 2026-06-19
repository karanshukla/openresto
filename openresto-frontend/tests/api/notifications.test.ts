import {
  getNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
  getVapidPublicKey,
  subscribePush,
  unsubscribePush,
  deleteNotification,
  deleteNotifications,
  deleteAllNotifications,
} from "@/api/notifications";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("getNotifications", () => {
  it("returns page data on success with all params", async () => {
    const data = { items: [], totalCount: 0 };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => data });

    const result = await getNotifications({
      restaurantId: 1,
      type: "BookingCreated",
      unreadOnly: true,
      page: 2,
      pageSize: 10,
    });

    expect(result).toEqual(data);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("/admin/notifications");
    expect(url).toContain("restaurantId=1");
    expect(url).toContain("type=BookingCreated");
    expect(url).toContain("unreadOnly=true");
    expect(url).toContain("page=2");
    expect(url).toContain("pageSize=10");
  });

  it("returns page data with no params (no query string)", async () => {
    const data = { items: [{ id: 1 }], totalCount: 1 };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => data });

    const result = await getNotifications({});
    expect(result).toEqual(data);
    const [url] = mockFetch.mock.calls[0];
    expect(url).not.toContain("?");
  });

  it("returns null when response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const result = await getNotifications({});
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));
    const result = await getNotifications({});
    expect(result).toBeNull();
  });

  it("omits optional params when falsy", async () => {
    const data = { items: [], totalCount: 0 };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => data });

    await getNotifications({ unreadOnly: false, type: "" });
    const [url] = mockFetch.mock.calls[0];
    expect(url).not.toContain("unreadOnly");
    expect(url).not.toContain("type");
  });
});

describe("getUnreadCount", () => {
  it("returns count from response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ count: 5 }) });
    const result = await getUnreadCount();
    expect(result).toBe(5);
  });

  it("appends restaurantId when provided", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ count: 3 }) });
    const result = await getUnreadCount(42);
    expect(result).toBe(3);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain("restaurantId=42");
  });

  it("returns 0 when response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const result = await getUnreadCount();
    expect(result).toBe(0);
  });

  it("returns 0 on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("fail"));
    const result = await getUnreadCount();
    expect(result).toBe(0);
  });

  it("returns 0 when count is missing from response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const result = await getUnreadCount();
    expect(result).toBe(0);
  });
});

describe("markRead", () => {
  it("patches the correct endpoint", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await markRead(7);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/admin/notifications/7/read");
    expect(opts.method).toBe("PATCH");
  });

  it("does not throw on error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("fail"));
    await expect(markRead(7)).resolves.toBeUndefined();
  });
});

describe("markAllRead", () => {
  it("patches the correct endpoint with restaurantId", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await markAllRead(3);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/admin/notifications/read-all");
    expect(url).toContain("restaurantId=3");
    expect(opts.method).toBe("PATCH");
  });

  it("does not throw on error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("fail"));
    await expect(markAllRead(3)).resolves.toBeUndefined();
  });
});

describe("getVapidPublicKey", () => {
  it("returns publicKey on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ publicKey: "abc123" }),
    });
    const result = await getVapidPublicKey();
    expect(result).toBe("abc123");
  });

  it("returns null on 204 (no vapid key configured)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 204 });
    const result = await getVapidPublicKey();
    expect(result).toBeNull();
  });

  it("returns null when response is not ok (non-204)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const result = await getVapidPublicKey();
    expect(result).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("fail"));
    const result = await getVapidPublicKey();
    expect(result).toBeNull();
  });

  it("returns null when publicKey is missing from response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    const result = await getVapidPublicKey();
    expect(result).toBeNull();
  });
});

describe("subscribePush", () => {
  it("posts to the correct endpoint with body", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const sub = { endpoint: "https://push.example.com/sub", p256dh: "key1", auth: "auth1" };
    await subscribePush(5, sub);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/admin/push/subscribe");
    expect(url).toContain("restaurantId=5");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual(sub);
  });

  it("does not throw on error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("fail"));
    await expect(
      subscribePush(5, { endpoint: "x", p256dh: "y", auth: "z" })
    ).resolves.toBeUndefined();
  });
});

describe("unsubscribePush", () => {
  it("sends DELETE to the correct endpoint", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await unsubscribePush("https://push.example.com/sub");
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/admin/push/subscribe");
    expect(opts.method).toBe("DELETE");
  });

  it("does not throw on error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("fail"));
    await expect(unsubscribePush("https://push.example.com/sub")).resolves.toBeUndefined();
  });
});

describe("deleteNotification", () => {
  it("sends DELETE to the correct endpoint", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await deleteNotification(99);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/admin/notifications/99");
    expect(opts.method).toBe("DELETE");
  });

  it("does not throw on error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("fail"));
    await expect(deleteNotification(99)).resolves.toBeUndefined();
  });
});

describe("deleteNotifications", () => {
  it("sends DELETE with array body", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await deleteNotifications([1, 2, 3]);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/admin/notifications");
    expect(opts.method).toBe("DELETE");
    expect(JSON.parse(opts.body)).toEqual([1, 2, 3]);
  });

  it("does not throw on error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("fail"));
    await expect(deleteNotifications([1])).resolves.toBeUndefined();
  });
});

describe("deleteAllNotifications", () => {
  it("sends DELETE with all query params", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await deleteAllNotifications({ restaurantId: 2, type: "BookingCancelled", unreadOnly: true });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/admin/notifications/all");
    expect(url).toContain("restaurantId=2");
    expect(url).toContain("type=BookingCancelled");
    expect(url).toContain("unreadOnly=true");
    expect(opts.method).toBe("DELETE");
  });

  it("sends DELETE with no query string when no params", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await deleteAllNotifications({});
    const [url] = mockFetch.mock.calls[0];
    expect(url).not.toContain("?");
  });

  it("does not throw on error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("fail"));
    await expect(deleteAllNotifications({})).resolves.toBeUndefined();
  });

  it("omits falsy optional params", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await deleteAllNotifications({ unreadOnly: false, type: "" });
    const [url] = mockFetch.mock.calls[0];
    expect(url).not.toContain("unreadOnly");
    expect(url).not.toContain("type");
  });
});
