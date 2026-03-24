import {
  login,
  logout,
  checkSession,
  changePassword,
  getPvqStatus,
  setupPvq,
  verifyPvq,
  resetPassword,
} from "@/api/auth";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("login", () => {
  it("posts credentials with credentials: include and returns response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Login successful." }),
    });

    const result = await login("admin@test.com", "pass123");
    expect(result).toEqual({ message: "Login successful." });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/auth/login");
    expect(opts.method).toBe("POST");
    expect(opts.credentials).toBe("include");
    expect(JSON.parse(opts.body)).toEqual({ email: "admin@test.com", password: "pass123" });
  });

  it("returns null on failed login", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await login("bad@email.com", "wrong")).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await login("a@b.com", "x")).toBeNull();
  });
});

describe("logout", () => {
  it("posts to /api/auth/logout with credentials: include", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await logout();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/auth/logout");
    expect(opts.method).toBe("POST");
    expect(opts.credentials).toBe("include");
  });

  it("does not throw on failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    await expect(logout()).resolves.toBeUndefined();
  });
});

describe("checkSession", () => {
  it("fetches /api/auth/me with credentials and returns session", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ email: "admin@test.com" }),
    });

    const result = await checkSession();
    expect(result).toEqual({ email: "admin@test.com" });
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/admin/auth/me");
    expect(opts.credentials).toBe("include");
  });

  it("returns null when not authenticated", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await checkSession()).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await checkSession()).toBeNull();
  });
});

describe("changePassword", () => {
  it("sends change request with credentials: include", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Password changed successfully." }),
    });

    const result = await changePassword("old", "new123");
    expect(result).toEqual({ ok: true, message: "Password changed successfully." });
    expect(mockFetch.mock.calls[0][1].credentials).toBe("include");
  });

  it("returns error message on failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Current password is incorrect." }),
    });

    const result = await changePassword("wrong", "new123");
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Current password is incorrect.");
  });

  it("returns network error on failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    const result = await changePassword("x", "y");
    expect(result).toEqual({ ok: false, message: "Network error." });
  });
});

describe("getPvqStatus", () => {
  it("fetches PVQ status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ isConfigured: true, question: "Pet name?" }),
    });

    const result = await getPvqStatus();
    expect(result).toEqual({ isConfigured: true, question: "Pet name?" });
  });

  it("returns null on failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await getPvqStatus()).toBeNull();
  });
});

describe("setupPvq", () => {
  it("posts PVQ setup with credentials: include", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Security question configured." }),
    });

    const result = await setupPvq("Pet name?", "Rex");
    expect(result.ok).toBe(true);
    expect(mockFetch.mock.calls[0][1].credentials).toBe("include");
  });

  it("returns network error on failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    const result = await setupPvq("Q?", "A");
    expect(result).toEqual({ ok: false, message: "Network error." });
  });
});

describe("verifyPvq", () => {
  it("returns reset token on correct answer", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ resetToken: "abc123" }),
    });

    const result = await verifyPvq("admin@test.com", "Rex");
    expect(result).toEqual({ resetToken: "abc123" });
  });

  it("returns null on wrong answer", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await verifyPvq("admin@test.com", "wrong")).toBeNull();
  });
});

describe("resetPassword", () => {
  it("posts reset with token", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Password reset successfully." }),
    });

    const result = await resetPassword("abc123", "newpass");
    expect(result).toEqual({ ok: true, message: "Password reset successfully." });
  });

  it("returns error on invalid token", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: "Invalid or expired reset token." }),
    });

    const result = await resetPassword("bad", "newpass");
    expect(result.ok).toBe(false);
  });

  it("returns network error on failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    const result = await resetPassword("tok", "pw");
    expect(result).toEqual({ ok: false, message: "Network error." });
  });
});
