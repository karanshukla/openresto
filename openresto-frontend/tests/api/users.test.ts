import {
  adminCreateUser,
  adminListUsers,
  adminResetUserPassword,
  adminSetUserActive,
  adminUpdateUserRole,
  type AdminUserDto,
} from "@/api/users";

const mockFetch = jest.fn();
global.fetch = mockFetch;

const USER: AdminUserDto = {
  id: 2,
  email: "manager@test.com",
  displayName: "Manny",
  role: "Manager",
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  hasSecurityQuestion: false,
};

beforeEach(() => {
  mockFetch.mockReset();
  jest.spyOn(console, "error").mockImplementation();
});

const okWith = (body: unknown) =>
  mockFetch.mockResolvedValueOnce({ ok: true, json: async () => body });
const failWith = (body: unknown) =>
  mockFetch.mockResolvedValueOnce({ ok: false, json: async () => body });

describe("adminListUsers", () => {
  it("fetches GET /api/admin/users", async () => {
    okWith([USER]);

    expect(await adminListUsers()).toEqual([USER]);
    expect(mockFetch.mock.calls[0][0]).toContain("/api/admin/users");
    expect(mockFetch.mock.calls[0][1].credentials).toBe("include");
  });

  it("returns null when refused", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    expect(await adminListUsers()).toBeNull();
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await adminListUsers()).toBeNull();
  });
});

describe("adminCreateUser", () => {
  const input = {
    email: "manager@test.com",
    password: "temp-password",
    displayName: "Manny",
    role: "Manager" as const,
  };

  it("posts the new account and returns it", async () => {
    okWith(USER);

    expect(await adminCreateUser(input)).toEqual({ ok: true, user: USER });
    expect(mockFetch.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual(input);
  });

  it("surfaces the server's rejection message", async () => {
    failWith({ message: "An account with that email address already exists." });

    expect(await adminCreateUser(input)).toEqual({
      ok: false,
      message: "An account with that email address already exists.",
    });
  });

  it("falls back to a generic message when the body carries none", async () => {
    failWith({});
    expect(await adminCreateUser(input)).toEqual({ ok: false, message: "Request failed." });
  });

  it("reports a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await adminCreateUser(input)).toEqual({ ok: false, message: "Network error." });
  });
});

describe("adminUpdateUserRole", () => {
  it("patches the role endpoint", async () => {
    okWith({ ...USER, role: "Owner" });

    const result = await adminUpdateUserRole(2, "Owner");

    expect(result).toEqual({ ok: true, user: { ...USER, role: "Owner" } });
    expect(mockFetch.mock.calls[0][0]).toContain("/api/admin/users/2/role");
    expect(mockFetch.mock.calls[0][1].method).toBe("PATCH");
  });

  it("surfaces the last-Owner guard", async () => {
    failWith({ message: "Cannot demote the last active Owner — promote another user first." });

    const result = await adminUpdateUserRole(1, "Manager");

    expect(result).toEqual({
      ok: false,
      message: "Cannot demote the last active Owner — promote another user first.",
    });
  });

  it("reports a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await adminUpdateUserRole(2, "Owner")).toEqual({ ok: false, message: "Network error." });
  });
});

describe("adminSetUserActive", () => {
  it("patches the active endpoint", async () => {
    okWith({ ...USER, isActive: false });

    const result = await adminSetUserActive(2, false);

    expect(result).toEqual({ ok: true, user: { ...USER, isActive: false } });
    expect(mockFetch.mock.calls[0][0]).toContain("/api/admin/users/2/active");
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ isActive: false });
  });

  it("reports a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await adminSetUserActive(2, false)).toEqual({ ok: false, message: "Network error." });
  });
});

describe("adminResetUserPassword", () => {
  it("posts the new password", async () => {
    okWith(USER);

    const result = await adminResetUserPassword(2, "owner-issued");

    expect(result).toEqual({ ok: true, user: USER });
    expect(mockFetch.mock.calls[0][0]).toContain("/api/admin/users/2/reset-password");
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({ newPassword: "owner-issued" });
  });

  it("surfaces a rejection", async () => {
    failWith({ message: "Password must be at least 6 characters." });

    expect(await adminResetUserPassword(2, "123")).toEqual({
      ok: false,
      message: "Password must be at least 6 characters.",
    });
  });

  it("reports a network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    expect(await adminResetUserPassword(2, "long-enough")).toEqual({
      ok: false,
      message: "Network error.",
    });
  });
});
