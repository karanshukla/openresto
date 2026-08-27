import { get, post } from "./client";
import { apiErrorMessage } from "@/api/errors";

export async function login(email: string, password: string): Promise<{ message: string } | null> {
  try {
    const res = await post("/admin/auth/login", { email, password });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("login error:", err);
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    await post("/admin/auth/logout");
  } catch {
    // Logout failed — non-critical, session will expire
  }
}

/**
 * The signed-in admin, as returned by `GET /admin/auth/me`. Treat unknown extra fields as
 * additive — the server may grow this shape (permissions, scoping) without a client change.
 */
export interface AuthUser {
  id: number;
  email: string;
  displayName: string | null;
  role: string;
}

export async function checkSession(): Promise<AuthUser | "rate-limited" | null> {
  try {
    const res = await get("/admin/auth/me");
    if (res.status === 429) return "rate-limited";
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await post("/admin/auth/change-password", { currentPassword, newPassword });
    const body = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      message: res.ok ? (body.message ?? "Done.") : apiErrorMessage(body, "Request failed."),
    };
  } catch {
    return { ok: false, message: "Network error." };
  }
}

export async function changeEmail(
  currentPassword: string,
  newEmail: string
): Promise<{ ok: boolean; message: string; email?: string }> {
  try {
    const res = await post("/admin/auth/change-email", { currentPassword, newEmail });
    const body = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      message: res.ok ? (body.message ?? "Done.") : apiErrorMessage(body, "Request failed."),
      email: body.email,
    };
  } catch {
    return { ok: false, message: "Network error." };
  }
}

export interface PvqStatus {
  isConfigured: boolean;
  question: string | null;
}

/** The security question for a given address — the forgot-password screen has no session yet. */
export async function getPvqStatus(email: string): Promise<PvqStatus | null> {
  try {
    const res = await get(`/admin/auth/pvq?email=${encodeURIComponent(email)}`, {
      credentials: "omit",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** The signed-in admin's own security question, for the settings screen. */
export async function getMyPvqStatus(): Promise<PvqStatus | null> {
  try {
    const res = await get("/admin/auth/pvq/me");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function setupPvq(
  question: string,
  answer: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await post("/admin/auth/pvq/setup", { question, answer });
    const body = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      message: res.ok ? (body.message ?? "Done.") : apiErrorMessage(body, "Failed."),
    };
  } catch {
    return { ok: false, message: "Network error." };
  }
}

/** Step 1 of forgot-password: answer the PVQ → returns a short-lived reset token. */
export async function verifyPvq(
  email: string,
  answer: string
): Promise<{ resetToken: string } | null> {
  try {
    const res = await post("/admin/auth/pvq/verify", { email, answer });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Step 2 of forgot-password: use reset token to set a new password. */
export async function resetPassword(
  resetToken: string,
  newPassword: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await post("/admin/auth/reset-password", { resetToken, newPassword });
    const body = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      message: res.ok ? (body.message ?? "Done.") : apiErrorMessage(body, "Failed."),
    };
  } catch {
    return { ok: false, message: "Network error." };
  }
}
