/**
 * A thin, hand-written fetch wrapper. Deliberately not generated: the OpenAPI document
 * (src/generated/api.d.ts) types request/response shapes, but the CLI's command structure is
 * hand-designed rather than mirroring generated operation ids — see README.md.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly body?: unknown;

  constructor(status: number, message: string, code?: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export interface ClientOptions {
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  /** Skip the X-API-Key header for this one call — used by the `/api/version` mismatch check,
   * a public endpoint the profile's key has no bearing on. */
  anonymous?: boolean;
}

export class Client {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ClientOptions) {
    if (!options.baseUrl) {
      throw new Error(
        "No server URL configured. Run `openresto auth login` or set OPENRESTO_URL.",
      );
    }
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async request<T = unknown>(
    method: string,
    urlPath: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = new URL(this.baseUrl + urlPath);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (!options.anonymous && this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }
    let body: string | undefined;
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method,
        headers,
        body,
        redirect: "manual",
      });
    } catch (err) {
      throw new Error(
        `Could not reach ${url.origin}: ${describeFetchFailure(err)}`,
      );
    }

    if (REDIRECT_STATUSES.has(response.status)) {
      throw new Error(describeRedirect(response, url));
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    let parsed: unknown = undefined;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!response.ok) {
      const { message, code } = extractError(parsed, response.status);
      throw new ApiError(response.status, message, code, parsed);
    }

    return parsed as T;
  }

  get<T = unknown>(urlPath: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("GET", urlPath, options);
  }
  post<T = unknown>(urlPath: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("POST", urlPath, options);
  }
  put<T = unknown>(urlPath: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("PUT", urlPath, options);
  }
  patch<T = unknown>(urlPath: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("PATCH", urlPath, options);
  }
  delete<T = unknown>(urlPath: string, options?: RequestOptions): Promise<T> {
    return this.request<T>("DELETE", urlPath, options);
  }
}

/** The server's error bodies are `{ message, code? }` (MessageResponse) or ASP.NET Core's
 * ProblemDetails (`{ title, detail? }`) for bare status-code responses. Falls back to a generic
 * message keyed by status code when neither shape is recognized. */
/**
 * Node's fetch reports every connection-level failure as a bare "fetch failed", hiding the
 * actionable part (ENOTFOUND, ECONNREFUSED, …) one level down in `cause` — surface that instead.
 */
function describeFetchFailure(err: unknown): string {
  if (err instanceof Error) {
    return err.cause instanceof Error ? err.cause.message : err.message;
  }
  return String(err);
}

const REDIRECT_STATUSES: ReadonlySet<number> = new Set([
  301, 302, 303, 307, 308,
]);

/**
 * The fetch spec strips `Authorization`, `Cookie` and `Proxy-Authorization` across a cross-origin
 * redirect but leaves custom headers alone, so a followed redirect would hand `X-API-Key` to
 * whichever origin the server names — including one a MITM on a plain-http deployment picked.
 * Requests therefore go out `redirect: "manual"` and a 3xx is reported rather than followed.
 *
 * @see [transport.test.ts](./transport.test.ts) — pins that a redirected request delivers the key
 * to the configured origin only, and that the error names the redirect target.
 */
function describeRedirect(response: Response, requestUrl: URL): string {
  const target = resolveRedirectTarget(
    response.headers.get("location"),
    requestUrl,
  );
  const destination = target
    ? `to ${target.href}`
    : "without a usable Location header";
  const remedy = target
    ? `If ${target.origin} is your server's real address, configure that instead`
    : "Configure the server's real address";
  return `${requestUrl.origin} redirected ${destination} (HTTP ${response.status}). The CLI does not follow redirects, because that would send your admin API key to the redirect target. ${remedy} — run \`openresto auth login\` or set OPENRESTO_URL.`;
}

function resolveRedirectTarget(
  location: string | null,
  requestUrl: URL,
): URL | null {
  if (!location) {
    return null;
  }
  try {
    return new URL(location, requestUrl);
  } catch {
    return null;
  }
}

function extractError(
  body: unknown,
  status: number,
): { message: string; code?: string } {
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    if (typeof obj.message === "string") {
      return {
        message: obj.message,
        code: typeof obj.code === "string" ? obj.code : undefined,
      };
    }
    if (typeof obj.detail === "string") {
      return { message: obj.detail };
    }
    if (typeof obj.title === "string") {
      return { message: obj.title };
    }
    if (Array.isArray(obj.errors)) {
      return { message: obj.errors.join("; ") };
    }
    // ASP.NET Core [ApiController] ModelState errors: { errors: { field: ["msg"] } }
    if (obj.errors && typeof obj.errors === "object") {
      const messages = Object.values(obj.errors as Record<string, unknown>)
        .flat()
        .filter((v): v is string => typeof v === "string");
      if (messages.length > 0) {
        return { message: messages.join("; ") };
      }
    }
  }
  return { message: `Request failed with status ${status}` };
}
