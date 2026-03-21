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

// ---------- API calls ----------

export interface LoginResponse {
  token: string;
}

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

export function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
