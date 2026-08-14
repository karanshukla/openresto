import {
  login,
  logout,
  checkSession,
  changePassword,
  changeEmail,
  getPvqStatus,
  getMyPvqStatus,
  setupPvq,
  verifyPvq,
  resetPassword,
} from "@/api/auth";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe("auth api", () => {
  describe("login", () => {
    it("returns data on success", async () => {
      const data = { message: "ok" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => data,
      });

      const res = await login("test@test.com", "pass");
      expect(res).toEqual(data);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/admin/auth/login"),
        expect.any(Object)
      );
    });

    it("returns null on failure", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      const res = await login("test@test.com", "pass");
      expect(res).toBeNull();
    });

    it("returns null on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("error"));
      const res = await login("test@test.com", "pass");
      expect(res).toBeNull();
    });
  });

  describe("logout", () => {
    it("calls logout endpoint", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      await logout();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/admin/auth/logout"),
        expect.any(Object)
      );
    });

    it("handles logout error silently", async () => {
      mockFetch.mockRejectedValueOnce(new Error("fail"));
      await logout();
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("checkSession", () => {
    it("returns email on success", async () => {
      const data = { email: "test@test.com" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => data,
      });
      const res = await checkSession();
      expect(res).toEqual(data);
    });

    it("returns 'rate-limited' on 429", async () => {
      mockFetch.mockResolvedValueOnce({ status: 429 });
      const res = await checkSession();
      expect(res).toBe("rate-limited");
    });

    it("returns null on other failure", async () => {
      mockFetch.mockResolvedValueOnce({ status: 401, ok: false });
      const res = await checkSession();
      expect(res).toBeNull();
    });

    it("returns null on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("fail"));
      const res = await checkSession();
      expect(res).toBeNull();
    });
  });

  describe("changePassword", () => {
    it("returns success on ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Success" }),
      });
      const res = await changePassword("old", "new");
      expect(res).toEqual({ ok: true, message: "Success" });
    });

    it("returns error message on failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Wrong password" }),
      });
      const res = await changePassword("old", "new");
      expect(res).toEqual({ ok: false, message: "Wrong password" });
    });

    it("returns network error message on exception", async () => {
      mockFetch.mockRejectedValueOnce(new Error("network"));
      const res = await changePassword("old", "new");
      expect(res.ok).toBe(false);
      expect(res.message).toBe("Network error.");
    });

    it("returns fallback message when body has no message and ok is false", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.reject(new Error("bad json")),
      });
      const res = await changePassword("old", "new");
      expect(res).toEqual({ ok: false, message: "Request failed." });
    });

    it("returns Done fallback when ok is true but body has no message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error("bad json")),
      });
      const res = await changePassword("old", "new");
      expect(res).toEqual({ ok: true, message: "Done." });
    });
  });

  describe("changeEmail", () => {
    it("returns success and new email on ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Email changed successfully.", email: "new@test.com" }),
      });
      const res = await changeEmail("pass", "new@test.com");
      expect(res).toEqual({
        ok: true,
        message: "Email changed successfully.",
        email: "new@test.com",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/admin/auth/change-email"),
        expect.any(Object)
      );
    });

    it("returns error message on failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Current password is incorrect." }),
      });
      const res = await changeEmail("wrong", "new@test.com");
      expect(res).toEqual({
        ok: false,
        message: "Current password is incorrect.",
        email: undefined,
      });
    });

    it("returns network error message on exception", async () => {
      mockFetch.mockRejectedValueOnce(new Error("network"));
      const res = await changeEmail("pass", "new@test.com");
      expect(res.ok).toBe(false);
      expect(res.message).toBe("Network error.");
    });

    it("returns fallback message when body has no message and ok is false", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.reject(new Error("bad json")),
      });
      const res = await changeEmail("pass", "new@test.com");
      expect(res).toEqual({ ok: false, message: "Request failed.", email: undefined });
    });

    it("returns Done fallback when ok is true but body has no message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error("bad json")),
      });
      const res = await changeEmail("pass", "new@test.com");
      expect(res).toEqual({ ok: true, message: "Done.", email: undefined });
    });
  });

  describe("getPvqStatus", () => {
    it("returns status on success", async () => {
      const data = { isConfigured: true, question: "What?" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => data,
      });
      const res = await getPvqStatus("admin@test.com");
      expect(res).toEqual(data);
    });

    it("keys the lookup by the encoded email", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      await getPvqStatus("a+b@test.com");
      expect(mockFetch.mock.calls[0][0]).toContain("/admin/auth/pvq?email=a%2Bb%40test.com");
    });

    it("returns null on failure", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      expect(await getPvqStatus("admin@test.com")).toBeNull();
    });

    it("returns null on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("fail"));
      expect(await getPvqStatus("admin@test.com")).toBeNull();
    });
  });

  describe("getMyPvqStatus", () => {
    it("returns the caller's own status on success", async () => {
      const data = { isConfigured: true, question: "Mine?" };
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => data });

      expect(await getMyPvqStatus()).toEqual(data);
      expect(mockFetch.mock.calls[0][0]).toContain("/admin/auth/pvq/me");
    });

    it("returns null on failure", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      expect(await getMyPvqStatus()).toBeNull();
    });

    it("returns null on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("fail"));
      expect(await getMyPvqStatus()).toBeNull();
    });
  });

  describe("setupPvq", () => {
    it("returns ok on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Done" }),
      });
      const res = await setupPvq("q", "a");
      expect(res).toEqual({ ok: true, message: "Done" });
    });

    it("returns error on network fail", async () => {
      mockFetch.mockRejectedValueOnce(new Error("fail"));
      const res = await setupPvq("q", "a");
      expect(res.ok).toBe(false);
    });

    it("returns fallback message when body has no message and ok is false", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.reject(new Error("bad json")),
      });
      const res = await setupPvq("q", "a");
      expect(res).toEqual({ ok: false, message: "Failed." });
    });

    it("returns Done fallback when ok is true but body has no message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error("bad json")),
      });
      const res = await setupPvq("q", "a");
      expect(res).toEqual({ ok: true, message: "Done." });
    });
  });

  describe("verifyPvq", () => {
    it("returns token on success", async () => {
      const data = { resetToken: "tok" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => data,
      });
      const res = await verifyPvq("email", "ans");
      expect(res).toEqual(data);
    });

    it("returns null on failure", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      expect(await verifyPvq("e", "a")).toBeNull();
    });

    it("returns null on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("fail"));
      expect(await verifyPvq("e", "a")).toBeNull();
    });
  });

  describe("resetPassword", () => {
    it("returns ok on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: "Reset" }),
      });
      const res = await resetPassword("tok", "new");
      expect(res).toEqual({ ok: true, message: "Reset" });
    });

    it("returns error on fail", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      const res = await resetPassword("tok", "new");
      expect(res.ok).toBe(false);
    });

    it("returns fallback message when body has no message and ok is false", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.reject(new Error("bad json")),
      });
      const res = await resetPassword("tok", "new");
      expect(res).toEqual({ ok: false, message: "Failed." });
    });

    it("returns Done fallback when ok is true but body has no message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error("bad json")),
      });
      const res = await resetPassword("tok", "new");
      expect(res).toEqual({ ok: true, message: "Done." });
    });
  });
});
