import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Command } from "commander";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

function capturingFetch(sent: { body: unknown }[]): typeof fetch {
  return (async (_input: string, init?: { body?: string }) => {
    sent.push({ body: init?.body ? JSON.parse(init.body) : undefined });
    return new Response(JSON.stringify({ message: "Email sent to a@b.com." }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

describe("bookings email", () => {
  /**
   * A message body is multi-line, so it comes from a file or stdin rather than a flag — a flag
   * would land the whole message in the shell history and make newlines the caller's escaping
   * problem.
   */
  test("sends the body read from --body-file verbatim, newlines included", async () => {
    const path = join(
      mkdtempSync(join(tmpdir(), "openresto-cli-")),
      "body.txt",
    );
    writeFileSync(path, "Dear guest,\n\nYour table is ready.\n");
    const sent: { body: unknown }[] = [];
    globalThis.fetch = capturingFetch(sent);
    const { restore } = captureLogs();

    try {
      await buildProgram().parseAsync(
        [
          "bookings",
          "email",
          "7",
          "--subject",
          "Your table",
          "--body-file",
          path,
        ],
        { from: "user" },
      );
    } finally {
      restore();
    }

    assert.deepEqual(sent[0].body, {
      subject: "Your table",
      body: "Dear guest,\n\nYour table is ready.\n",
    });
  });

  test("refuses an empty body instead of sending a blank email", async () => {
    const path = join(
      mkdtempSync(join(tmpdir(), "openresto-cli-")),
      "empty.txt",
    );
    writeFileSync(path, "   \n");
    const sent: { body: unknown }[] = [];
    globalThis.fetch = capturingFetch(sent);
    const { lines, restore } = captureLogs();

    try {
      await buildProgram().parseAsync(
        ["bookings", "email", "7", "--subject", "S", "--body-file", path],
        { from: "user" },
      );
    } finally {
      restore();
    }

    assert.equal(sent.length, 0);
    assert.match(lines.join("\n"), /body is empty/);
    // `handle` reports a failed command through the exit code; clear it so it doesn't leak
    // into this test file's own exit status.
    assert.equal(process.exitCode, 1);
    process.exitCode = 0;
  });
});
