const API_URL = process.env.EXPO_PUBLIC_API_URL;

export function buildUrl(path: string): string {
  const base = API_URL?.replace(/\/$/, "") ?? "";
  if (!base) return `/api${path}`;
  return base.includes("/api") ? `${base}${path}` : `${base}/api${path}`;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions {
  body?: unknown;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;
}

export async function api(
  method: Method,
  path: string,
  opts: RequestOptions = {}
): Promise<Response> {
  const headers: Record<string, string> = { ...opts.headers };

  let rawBody: string | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    rawBody = JSON.stringify(opts.body);
  }

  return fetch(buildUrl(path), {
    method,
    headers,
    body: rawBody,
    credentials: opts.credentials ?? "include",
  });
}

export const get = (path: string, opts?: RequestOptions) => api("GET", path, opts);

export const post = (path: string, body?: unknown, opts?: RequestOptions) =>
  api("POST", path, { ...opts, body });

export const put = (path: string, body?: unknown, opts?: RequestOptions) =>
  api("PUT", path, { ...opts, body });

export const patch = (path: string, body?: unknown, opts?: RequestOptions) =>
  api("PATCH", path, { ...opts, body });

export const del = (path: string, opts?: RequestOptions) => api("DELETE", path, opts);
