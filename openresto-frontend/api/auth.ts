import { get, post } from "./client";

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
    console.log("Error logging out, if you see this, clear your cache and cookies!");
  }
}

// ---------- Session check ----------

export async function checkSession(): Promise<{ email: string } | null> {
  try {
    const res = await get("/admin/auth/me");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---------- Password management ----------

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await post("/admin/auth/change-password", { currentPassword, newPassword });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, message: body.message ?? (res.ok ? "Done." : "Request failed.") };
  } catch {
    return { ok: false, message: "Network error." };
  }
}

// ---------- PVQ (Personal Verification Questions) ----------

export interface PvqStatus {
  isConfigured: boolean;
  question: string | null;
}

export async function getPvqStatus(): Promise<PvqStatus | null> {
  try {
    const res = await get("/admin/auth/pvq", { credentials: "omit" });
    if (!res.ok) return null;
    return await res.json();
  } catch /* istanbul ignore next */ {
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
    return { ok: res.ok, message: body.message ?? (res.ok ? "Done." : "Failed.") };
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
  } catch /* istanbul ignore next */ {
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
    return { ok: res.ok, message: body.message ?? (res.ok ? "Done." : "Failed.") };
  } catch {
    return { ok: false, message: "Network error." };
  }
}
