import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Command } from "commander";
import { registerBookingsCommands } from "./bookings.js";

function buildProgram(): Command {
  const program = new Command();
  program
    .exitOverride()
    .option("--profile <name>")
    .option("--json")
    .option("--yes");
  registerBookingsCommands(program);
  return program;
}

function fakeFetch(body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
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

const ROWS = [
  { id: 1, restaurantName: "Pasta Place", seats: 2, isCancelled: false },
  { id: 2, restaurantName: "Pasta Place", seats: 4, isCancelled: true },
];

describe("bookings list status column", () => {
  test("the table view derives status from isCancelled instead of an empty column", async () => {
    globalThis.fetch = fakeFetch(ROWS);
    const { lines, restore } = captureLogs();

    try {
      await buildProgram().parseAsync(["bookings", "list"], { from: "user" });
    } finally {
      restore();
    }

    const output = lines.join("\n");
    assert.match(output, /active/);
    assert.match(output, /cancelled/);
  });

  test("the --json output stays the raw DTO with no injected status field", async () => {
    globalThis.fetch = fakeFetch(ROWS);
    const { lines, restore } = captureLogs();

    try {
      await buildProgram().parseAsync(["bookings", "list", "--json"], {
        from: "user",
      });
    } finally {
      restore();
    }

    const parsed = JSON.parse(lines.join("\n")) as Record<string, unknown>[];
    assert.equal(parsed.length, 2);
    assert.ok(!("status" in parsed[0]));
    assert.equal(parsed[1].isCancelled, true);
  });
});
