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
  });

  describe("getPvqStatus", () => {
    it("returns status on success", async () => {
      const data = { isConfigured: true, question: "What?" };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => data,
      });
      const res = await getPvqStatus();
      expect(res).toEqual(data);
    });

    it("returns null on failure", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      expect(await getPvqStatus()).toBeNull();
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
  });
});
