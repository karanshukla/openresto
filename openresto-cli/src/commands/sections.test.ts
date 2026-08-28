import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Command } from "commander";
import { registerSectionsCommands } from "./sections.js";

interface Call {
  method: string;
  url: string;
  body: unknown;
}

function buildProgram(): Command {
  const program = new Command();
  program
    .exitOverride()
    .option("--profile <name>")
    .option("--json")
    .option("--yes");
  registerSectionsCommands(program);
  return program;
}

function fakeFetch(
  responder: (call: Call) => { status: number; body?: unknown },
): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const call: Call = { method: init?.method ?? "GET", url, body };
    calls.push(call);
    const { status, body: responseBody } = responder(call);
    const text = responseBody === undefined ? "" : JSON.stringify(responseBody);
    return new Response(text || null, {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
  return { fetch: impl, calls };
}

function captureLogs(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => lines.push(args.map(String).join(" "));
  console.error = (...args: unknown[]) =>
    lines.push(args.map(String).join(" "));
  return {
    lines,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
    },
  };
}

let originalFetch: typeof fetch;
let originalUrl: string | undefined;
let originalKey: string | undefined;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  originalUrl = process.env.OPENRESTO_URL;
  originalKey = process.env.OPENRESTO_API_KEY;
  process.env.OPENRESTO_URL = "https://cli.example";
  process.env.OPENRESTO_API_KEY = "test-key";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.OPENRESTO_URL;
  else process.env.OPENRESTO_URL = originalUrl;
  if (originalKey === undefined) delete process.env.OPENRESTO_API_KEY;
  else process.env.OPENRESTO_API_KEY = originalKey;
});

describe("sections list", () => {
  test("GETs the admin sections lookup for the given location", async () => {
    const { fetch, calls } = fakeFetch(() => ({
      status: 200,
      body: [{ id: 1, name: "Patio" }],
    }));
    globalThis.fetch = fetch;
    const { lines, restore } = captureLogs();

    try {
      await buildProgram().parseAsync(
        ["sections", "list", "--location", "7", "--json"],
        { from: "user" },
      );
    } finally {
      restore();
    }

    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "GET");
    assert.equal(
      calls[0].url,
      "https://cli.example/api/admin/restaurants/7/sections",
    );
    assert.match(lines.join("\n"), /"name": "Patio"/);
  });
});

describe("sections create", () => {
  test("POSTs the new section's name to the restaurant-scoped endpoint", async () => {
    const { fetch, calls } = fakeFetch(() => ({
      status: 200,
      body: { id: 9, name: "Patio", sortOrder: 2, tables: [] },
    }));
    globalThis.fetch = fetch;
    const { restore } = captureLogs();

    try {
      await buildProgram().parseAsync(
        ["sections", "create", "--location", "7", "--name", "Patio"],
        { from: "user" },
      );
    } finally {
      restore();
    }

    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "POST");
    assert.equal(
      calls[0].url,
      "https://cli.example/api/restaurants/7/sections",
    );
    assert.deepEqual(calls[0].body, { name: "Patio" });
  });
});

describe("sections update", () => {
  test("PUTs the rename to the section's own URL", async () => {
    const { fetch, calls } = fakeFetch(() => ({
      status: 200,
      body: { id: 9, name: "Renamed", sortOrder: 2, tables: [] },
    }));
    globalThis.fetch = fetch;
    const { restore } = captureLogs();

    try {
      await buildProgram().parseAsync(
        ["sections", "update", "9", "--location", "7", "--name", "Renamed"],
        { from: "user" },
      );
    } finally {
      restore();
    }

    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "PUT");
    assert.equal(
      calls[0].url,
      "https://cli.example/api/restaurants/7/sections/9",
    );
    assert.deepEqual(calls[0].body, { name: "Renamed" });
  });
});

describe("sections delete", () => {
  test("--yes skips the prompt, previews the booking impact, then deletes", async () => {
    const { fetch, calls } = fakeFetch((call) => {
      if (call.url.endsWith("/impact")) {
        return { status: 200, body: { bookings: 3 } };
      }
      return { status: 204 };
    });
    globalThis.fetch = fetch;
    const { lines, restore } = captureLogs();

    try {
      await buildProgram().parseAsync(
        ["sections", "delete", "9", "--location", "7", "--yes"],
        { from: "user" },
      );
    } finally {
      restore();
    }

    assert.equal(calls.length, 2);
    assert.ok(calls[0].url.endsWith("/api/restaurants/7/sections/9/impact"));
    assert.equal(calls[1].method, "DELETE");
    assert.equal(
      calls[1].url,
      "https://cli.example/api/restaurants/7/sections/9",
    );
    assert.match(lines.join("\n"), /Section 9 removed\./);
  });

  test("without --yes and no TTY, refuses before ever calling delete", async () => {
    const { fetch, calls } = fakeFetch((call) => {
      if (call.url.endsWith("/impact")) {
        return { status: 200, body: { bookings: 0 } };
      }
      return { status: 204 };
    });
    globalThis.fetch = fetch;
    const originalIsTTY = process.stdin.isTTY;
    process.stdin.isTTY = false;
    const { lines, restore } = captureLogs();
    const originalExitCode = process.exitCode;
    process.exitCode = undefined;

    try {
      await buildProgram().parseAsync(
        ["sections", "delete", "9", "--location", "7"],
        {
          from: "user",
        },
      );
    } finally {
      restore();
      process.stdin.isTTY = originalIsTTY;
    }

    assert.ok(!calls.some((c) => c.method === "DELETE"));
    assert.equal(process.exitCode, 1);
    assert.match(lines.join("\n"), /--yes/);
    process.exitCode = originalExitCode;
  });
});
