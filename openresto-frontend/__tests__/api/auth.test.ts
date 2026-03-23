import {
  getStoredToken,
  getAuthHeaders,
  login,
  logout,
  changePassword,
  getPvqStatus,
  setupPvq,
  verifyPvq,
  resetPassword,
} from "@/api/auth";

const mockFetch = jest.fn();
global.fetch = mockFetch;

// Provide a minimal localStorage mock
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: jest.fn((key: string) => store[key] ?? null),
  setItem: jest.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete store[key];
  }),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

beforeEach(() => {
  mockFetch.mockReset();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  // Clear stored tokens between tests
  Object.keys(store).forEach((k) => delete store[k]);
  jest.spyOn(console, "error").mockImplementation();
});

// ---------- Token helpers ----------

describe("getStoredToken", () => {
  it("returns token from localStorage", () => {
    store["openresto_admin_token"] = "abc123";
    expect(getStoredToken()).toBe("abc123");
  });

  it("returns null when no token is stored", () => {
    expect(getStoredToken()).toBeNull();
  });
});

describe("getAuthHeaders", () => {
  it("returns Authorization header when token exists", () => {
    store["openresto_admin_token"] = "mytoken";
    expect(getAuthHeaders()).toEqual({ Authorization: "Bearer mytoken" });
  });

  it("returns empty object when no token", () => {
    expect(getAuthHeaders()).toEqual({});
  });
});

// ---------- Login / logout ----------

describe("login", () => {
  it("posts credentials and stores token on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: "jwt123" }),
    });

    const result = await login("admin@test.com", "password");

    expect(result).toEqual({ token: "jwt123" });
    expect(localStorageMock.setItem).toHaveBeenCalledWith("openresto_admin_token", "jwt123");

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/auth/login");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ email: "admin@test.com", password: "password" });
  });

  it("returns null on non-ok response without storing token", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    const result = await login("admin@test.com", "wrong");

    expect(result).toBeNull();
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));

    const result = await login("a@b.com", "pw");
    expect(result).toBeNull();
  });
});

describe("logout", () => {
  it("removes token from localStorage", () => {
    store["openresto_admin_token"] = "tok";
    logout();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("openresto_admin_token");
  });
});

// ---------- Password management ----------

describe("changePassword", () => {
  it("posts change-password and returns success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Password changed." }),
    });

    // Need a token so auth headers are sent
    store["openresto_admin_token"] = "tok";
    const result = await changePassword("old", "new");

    expect(result).toEqual({ ok: true, message: "Password changed." });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/auth/change-password");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Authorization"]).toBe("Bearer tok");
  });

  it("returns ok false with message on server rejection", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Wrong current password." }),
    });

    const result = await changePassword("wrong", "new");
    expect(result).toEqual({ ok: false, message: "Wrong current password." });
  });

  it("returns network error on exception", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));

    const result = await changePassword("a", "b");
    expect(result).toEqual({ ok: false, message: "Network error." });
  });
});

// ---------- PVQ ----------

describe("getPvqStatus", () => {
  it("fetches PVQ status and returns data", async () => {
    const status = { isConfigured: true, question: "Favorite color?" };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => status });

    const result = await getPvqStatus();

    expect(result).toEqual(status);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/auth/pvq");
  });

  it("returns null on non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await getPvqStatus()).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await getPvqStatus()).toBeNull();
  });
});

describe("setupPvq", () => {
  it("posts PVQ setup with auth headers and returns success", async () => {
    store["openresto_admin_token"] = "tok";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "PVQ saved." }),
    });

    const result = await setupPvq("Favorite color?", "blue");

    expect(result).toEqual({ ok: true, message: "PVQ saved." });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/auth/pvq/setup");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Authorization"]).toBe("Bearer tok");
    expect(JSON.parse(opts.body)).toEqual({ question: "Favorite color?", answer: "blue" });
  });

  it("returns ok false on failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Invalid." }),
    });

    const result = await setupPvq("q", "a");
    expect(result.ok).toBe(false);
  });

  it("returns network error on exception", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));

    const result = await setupPvq("q", "a");
    expect(result).toEqual({ ok: false, message: "Network error." });
  });
});

describe("verifyPvq", () => {
  it("posts email and answer, returns resetToken on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ resetToken: "rst123" }),
    });

    const result = await verifyPvq("admin@test.com", "blue");

    expect(result).toEqual({ resetToken: "rst123" });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/auth/pvq/verify");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ email: "admin@test.com", answer: "blue" });
  });

  it("returns null on wrong answer (non-ok)", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await verifyPvq("a@b.com", "wrong")).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await verifyPvq("a@b.com", "x")).toBeNull();
  });
});

describe("resetPassword", () => {
  it("posts reset token and new password, returns success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Password reset." }),
    });

    const result = await resetPassword("rst123", "newpass");

    expect(result).toEqual({ ok: true, message: "Password reset." });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/auth/reset-password");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ resetToken: "rst123", newPassword: "newpass" });
  });

  it("returns ok false on failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Token expired." }),
    });

    const result = await resetPassword("expired", "pw");
    expect(result).toEqual({ ok: false, message: "Token expired." });
  });

  it("returns network error on exception", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));

    const result = await resetPassword("t", "p");
    expect(result).toEqual({ ok: false, message: "Network error." });
  });
});
