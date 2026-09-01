import Constants from "expo-constants";

/**
 * The API base is a build-time constant either way: `EXPO_PUBLIC_API_URL` is inlined by Metro
 * (the Docker web build passes `/api`), and `extra.apiUrl` is baked into the binary by
 * `app.config.ts` from the self-hoster's generated `native/app.native.json`. The env var wins
 * so a developer can still point a native dev client at a local server without regenerating.
 *
 * @see [client.test.ts](../tests/api/client.test.ts) — pins that the env var takes precedence
 * over `extra.apiUrl` and that a non-string `extra.apiUrl` is ignored.
 */
export function configuredApiUrl(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv;
  const extra = Constants.expoConfig?.extra as { apiUrl?: unknown } | undefined;
  return typeof extra?.apiUrl === "string" && extra.apiUrl ? extra.apiUrl : undefined;
}

export function buildUrl(path: string): string {
  const base = configuredApiUrl()?.replace(/\/$/, "") ?? "";
  if (!base) return `/api${path}`;

  // Check if the URL path already contains /api as a segment
  const urlObj = (() => {
    try {
      return new URL(base);
    } catch {
      return null;
    }
  })();

  const hasApi = urlObj ? urlObj.pathname.split("/").includes("api") : base.includes("/api");

  return hasApi ? `${base}${path}` : `${base}/api${path}`;
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

  const fetchOpts: RequestInit = {
    method,
    headers,
    body: rawBody,
    credentials: opts.credentials ?? "include",
  };

  const response = await fetch(buildUrl(path), fetchOpts);
  return response;
}

export const get = (path: string, opts?: RequestOptions) => api("GET", path, opts);

export const post = (path: string, body?: unknown, opts?: RequestOptions) =>
  api("POST", path, { ...opts, body });

export const put = (path: string, body?: unknown, opts?: RequestOptions) =>
  api("PUT", path, { ...opts, body });

export const patch = (path: string, body?: unknown, opts?: RequestOptions) =>
  api("PATCH", path, { ...opts, body });

export const del = (path: string, opts?: RequestOptions) => api("DELETE", path, opts);
