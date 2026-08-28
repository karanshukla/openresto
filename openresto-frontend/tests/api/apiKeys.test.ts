import {
  adminCreateApiKey,
  adminListApiKeys,
  adminRevokeApiKey,
  READ_ONLY_SCOPE_RESOURCES,
  type ApiKeyDto,
  type CreatedApiKey,
} from "@/api/apiKeys";

const mockFetch = jest.fn();
global.fetch = mockFetch;

const KEY: ApiKeyDto = {
  id: 7,
  name: "Reservations widget",
  prefix: "orst_12",
  scopes: [{ resource: "bookings", access: "read" }],
  createdAt: "2026-01-01T00:00:00Z",
  lastUsedAt: null,
  expiresAt: null,
  revokedAt: null,
};

const CREATED: CreatedApiKey = { ...KEY, secret: "orst_12_supersecretvalue" };

beforeEach(() => {
  mockFetch.mockReset();
  jest.spyOn(console, "error").mockImplementation();
});

const okWith = (body: unknown) =>
  mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => body });
const failWith = (body: unknown) =>
  mockFetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => body });

describe("READ_ONLY_SCOPE_RESOURCES", () => {
  it("marks exactly audit and guests as write-ineligible, mirroring the backend allow-list", () => {
    expect(READ_ONLY_SCOPE_RESOURCES.has("audit")).toBe(true);
    expect(READ_ONLY_SCOPE_RESOURCES.has("guests")).toBe(true);
    expect(READ_ONLY_SCOPE_RESOURCES.has("bookings")).toBe(false);
  });
});

describe("adminListApiKeys", () => {
  it("fetches GET /api/admin/api-keys", async () => {
    okWith([KEY]);

    expect(await adminListApiKeys()).toEqual([KEY]);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/admin/api-keys");
    expect(mockFetch.mock.calls[0][1].credentials).toBe("include");
  });

  it("returns null when refused", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await adminListApiKeys()).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await adminListApiKeys()).toBeNull();
  });
});

describe("adminCreateApiKey", () => {
  const input = {
    name: "Reservations widget",
    scopes: [{ resource: "bookings" as const, access: "read" as const }],
  };

  it("posts the new key and returns the secret", async () => {
    okWith(CREATED);

    const result = await adminCreateApiKey(input);

    expect(result).toEqual({ ok: true, key: CREATED });
    expect(mockFetch.mock.calls[0][0]).toContain("/api/admin/api-keys");
    expect(mockFetch.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual(input);
  });

  it("passes an expiresAt when supplied", async () => {
    okWith(CREATED);

    await adminCreateApiKey({ ...input, expiresAt: "2027-01-01T00:00:00.000Z" });

    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      ...input,
      expiresAt: "2027-01-01T00:00:00.000Z",
    });
  });

  it("passes neverExpires when the caller opts out of expiry entirely", async () => {
    okWith({ ...CREATED, expiresAt: null });

    await adminCreateApiKey({ ...input, neverExpires: true });

    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      ...input,
      neverExpires: true,
    });
  });

  it("surfaces the server's rejection message", async () => {
    failWith({ message: "A key with that name already exists." });

    expect(await adminCreateApiKey(input)).toEqual({
      ok: false,
      message: "A key with that name already exists.",
    });
  });

  it("falls back to a generic message when the body carries none", async () => {
    failWith({});
    expect(await adminCreateApiKey(input)).toEqual({ ok: false, message: "Request failed." });
  });

  it("reports a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await adminCreateApiKey(input)).toEqual({ ok: false, message: "Network error." });
  });
});

describe("adminRevokeApiKey", () => {
  it("posts to the revoke endpoint and returns the updated row", async () => {
    okWith({ ...KEY, revokedAt: "2026-03-01T00:00:00Z" });

    const result = await adminRevokeApiKey(7);

    expect(result).toEqual({ ok: true, key: { ...KEY, revokedAt: "2026-03-01T00:00:00Z" } });
    expect(mockFetch.mock.calls[0][0]).toContain("/api/admin/api-keys/7/revoke");
    expect(mockFetch.mock.calls[0][1].method).toBe("POST");
  });

  it("treats a bare 204 as success with no row", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });

    expect(await adminRevokeApiKey(7)).toEqual({ ok: true, key: null });
  });

  it("surfaces a rejection", async () => {
    failWith({ message: "That key is already revoked." });

    expect(await adminRevokeApiKey(7)).toEqual({
      ok: false,
      message: "That key is already revoked.",
    });
  });

  it("reports a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await adminRevokeApiKey(7)).toEqual({ ok: false, message: "Network error." });
  });
});
