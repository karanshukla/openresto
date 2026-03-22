const API_URL = process.env.EXPO_PUBLIC_API_URL;
const TOKEN_KEY = "openresto_admin_token";

function buildEndpoint(path: string): string {
  const base = API_URL?.replace(/\/$/, "") ?? "";
  if (!base) return `/api${path}`;
  return base.includes("/api") ? `${base}${path}` : `${base}/api${path}`;
}

// ---------- Token storage (web-first) ----------

export function getStoredToken(): string | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return localStorage.getItem(TOKEN_KEY);
  }
  return null;
}

function storeToken(token: string): void {
  if (typeof window !== "undefined" && window.localStorage) {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

function removeToken(): void {
  if (typeof window !== "undefined" && window.localStorage) {
    localStorage.removeItem(TOKEN_KEY);
  }
}

// ---------- Auth helpers ----------

export interface LoginResponse {
  token: string;
}

export function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

// ---------- Login / logout ----------

export async function login(
  email: string,
  password: string
): Promise<{ token: string } | null> {
  try {
    const res = await fetch(buildEndpoint("/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) return null;

    const data: LoginResponse = await res.json();
    storeToken(data.token);
    return data;
  } catch (err) {
    console.error("login error:", err);
    return null;
  }
}

export function logout(): void {
  removeToken();
}

// ---------- Password management ----------

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(buildEndpoint("/auth/change-password"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
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
    const res = await fetch(buildEndpoint("/auth/pvq"));
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
    const res = await fetch(buildEndpoint("/auth/pvq/setup"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify({ question, answer }),
    });
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
    const res = await fetch(buildEndpoint("/auth/pvq/verify"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, answer }),
    });
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
    const res = await fetch(buildEndpoint("/auth/reset-password"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetToken, newPassword }),
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, message: body.message ?? (res.ok ? "Done." : "Failed.") };
  } catch {
    return { ok: false, message: "Network error." };
  }
}
