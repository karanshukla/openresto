import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ApiError, Client } from "./transport.js";

function fakeFetch(
  handler: (
    url: string,
    init: RequestInit,
  ) => { status: number; body?: unknown },
): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const { status, body } = handler(url, init ?? {});
    const text = body === undefined ? null : JSON.stringify(body);
    return new Response(text, {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

describe("Client", () => {
  test("throws immediately when no baseUrl is configured", () => {
    assert.throws(
      () => new Client({ baseUrl: "" }),
      /No server URL configured/,
    );
  });

  test("injects the X-API-Key header when a key is configured", async () => {
    let seenHeaders: Headers | undefined;
    const client = new Client({
      baseUrl: "https://api.example",
      apiKey: "orst_1_secret",
      fetchImpl: (async (_input, init) => {
        seenHeaders = new Headers(init?.headers);
        return new Response("{}", { status: 200 });
      }) as typeof fetch,
    });

    await client.get("/api/admin/overview");

    assert.equal(seenHeaders?.get("X-API-Key"), "orst_1_secret");
  });

  test("omits the X-API-Key header when no key is configured", async () => {
    let seenHeaders: Headers | undefined;
    const client = new Client({
      baseUrl: "https://api.example",
      fetchImpl: (async (_input, init) => {
        seenHeaders = new Headers(init?.headers);
        return new Response("{}", { status: 200 });
      }) as typeof fetch,
    });

    await client.get("/api/brand");

    assert.equal(seenHeaders?.has("X-API-Key"), false);
  });

  test("builds query strings from defined values only, skipping undefined", async () => {
    let seenUrl = "";
    const client = new Client({
      baseUrl: "https://api.example",
      fetchImpl: (async (input) => {
        seenUrl = input.toString();
        return new Response("[]", { status: 200 });
      }) as typeof fetch,
    });

    await client.get("/api/admin/bookings", {
      query: { date: "2026-01-01", email: undefined, seats: 4 },
    });

    const url = new URL(seenUrl);
    assert.equal(url.searchParams.get("date"), "2026-01-01");
    assert.equal(url.searchParams.has("email"), false);
    assert.equal(url.searchParams.get("seats"), "4");
  });

  test("sends a JSON body with Content-Type when a body is given", async () => {
    let seenBody = "";
    let seenHeaders: Headers | undefined;
    const client = new Client({
      baseUrl: "https://api.example",
      fetchImpl: (async (_input, init) => {
        seenBody = String(init?.body ?? "");
        seenHeaders = new Headers(init?.headers);
        return new Response("{}", { status: 201 });
      }) as typeof fetch,
    });

    await client.post("/api/admin/restaurants", { body: { name: "Bistro" } });

    assert.deepEqual(JSON.parse(seenBody), { name: "Bistro" });
    assert.equal(seenHeaders?.get("Content-Type"), "application/json");
  });

  test("204 No Content resolves to undefined rather than a parse error", async () => {
    const client = new Client({
      baseUrl: "https://api.example",
      fetchImpl: fakeFetch(() => ({ status: 204 })),
    });

    const result = await client.delete("/api/admin/bookings/1");

    assert.equal(result, undefined);
  });

  test("a 2xx response returns the parsed JSON body", async () => {
    const client = new Client({
      baseUrl: "https://api.example",
      fetchImpl: fakeFetch(() => ({ status: 200, body: { id: 1 } })),
    });

    const result = await client.get<{ id: number }>("/api/admin/bookings/1");

    assert.deepEqual(result, { id: 1 });
  });

  test("a non-2xx response throws ApiError carrying the server's message and code", async () => {
    const client = new Client({
      baseUrl: "https://api.example",
      fetchImpl: fakeFetch(() => ({
        status: 403,
        body: {
          message: "This API key is missing the 'bookings:write' scope.",
          code: "api_key.scope_missing",
        },
      })),
    });

    await assert.rejects(
      () => client.post("/api/admin/bookings"),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 403);
        assert.equal(err.code, "api_key.scope_missing");
        assert.match(err.message, /bookings:write/);
        return true;
      },
    );
  });

  test("a ProblemDetails-shaped error body (bare status code) still yields a readable message", async () => {
    const client = new Client({
      baseUrl: "https://api.example",
      fetchImpl: fakeFetch(() => ({
        status: 404,
        body: {
          title: "Not Found",
          detail: "The requested API endpoint does not exist.",
        },
      })),
    });

    await assert.rejects(
      () => client.get("/api/admin/nope"),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.match(err.message, /does not exist/);
        return true;
      },
    );
  });

  test("an unrecognized non-JSON error body still throws with a generic status-coded message", async () => {
    const client = new Client({
      baseUrl: "https://api.example",
      fetchImpl: (async () =>
        new Response("", { status: 500 })) as typeof fetch,
    });

    await assert.rejects(
      () => client.get("/api/admin/overview"),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 500);
        assert.match(err.message, /500/);
        return true;
      },
    );
  });

  test("a trailing slash on baseUrl does not produce a double slash in the request URL", async () => {
    let seenUrl = "";
    const client = new Client({
      baseUrl: "https://api.example/",
      fetchImpl: (async (input) => {
        seenUrl = input.toString();
        return new Response("{}", { status: 200 });
      }) as typeof fetch,
    });

    await client.get("/api/brand");

    assert.equal(seenUrl, "https://api.example/api/brand");
  });
});

describe("connection failures", () => {
  test("an unreachable server names the origin and the underlying cause, not bare fetch failed", async () => {
    const client = new Client({
      baseUrl: "https://gone.example",
      fetchImpl: (async () => {
        throw new Error("fetch failed", {
          cause: new Error("getaddrinfo ENOTFOUND gone.example"),
        });
      }) as typeof fetch,
    });

    await assert.rejects(
      () => client.get("/api/brand"),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /https:\/\/gone\.example/);
        assert.match(err.message, /ENOTFOUND/);
        return true;
      },
    );
  });
});
