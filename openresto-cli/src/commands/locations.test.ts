import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Command } from "commander";
import { registerLocationsCommands } from "./locations.js";

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
  registerLocationsCommands(program);
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

async function run(args: string[]): Promise<string[]> {
  const { lines, restore } = captureLogs();
  try {
    await buildProgram().parseAsync(args, { from: "user" });
  } finally {
    restore();
  }
  return lines;
}

/** `handle` reports a failed command through the exit code; read and clear it so it doesn't
 * leak into this test file's own exit status. */
function takeExitCode(): typeof process.exitCode {
  const code = process.exitCode;
  process.exitCode = 0;
  return code;
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

const LOCATION = {
  id: 1,
  name: "Pasta Place",
  address: "1 High Street",
  openTime: "12:00",
  closeTime: "22:00",
  maxTableOversizeSeats: 2,
  maxCoversPerSlot: 12,
  maxBookingDaysAhead: 30,
  minBookingNoticeMinutes: null,
  minOnlinePartySize: 2,
  maxOnlinePartySize: 8,
  dateExceptions: [
    { date: "2026-12-24", type: "walkInOnly" },
    { date: "2026-12-25", type: "closed" },
  ],
};

/** Answers the GET with the fixture and echoes a PUT body back as the saved record. */
function readModifyWriteFetch(): { fetch: typeof fetch; calls: Call[] } {
  return fakeFetch((call) => {
    if (call.method === "PUT") {
      return {
        status: 200,
        body: { ...LOCATION, ...(call.body as Record<string, unknown>) },
      };
    }
    return { status: 200, body: LOCATION };
  });
}

const CARRIED = {
  name: "Pasta Place",
  address: "1 High Street",
  maxTableOversizeSeats: 2,
  maxCoversPerSlot: 12,
  maxBookingDaysAhead: 30,
  minBookingNoticeMinutes: null,
  minOnlinePartySize: 2,
  maxOnlinePartySize: 8,
};

describe("locations pause", () => {
  test("--rest-of-today sends until endOfService and prints when the pause lifts", async () => {
    const { fetch, calls } = fakeFetch(() => ({
      status: 200,
      body: {
        message: "Bookings paused successfully.",
        bookingsPausedUntil: "2026-11-06T22:00:00Z",
      },
    }));
    globalThis.fetch = fetch;

    const lines = await run(["locations", "pause", "1", "--rest-of-today"]);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "POST");
    assert.equal(
      calls[0].url,
      "https://cli.example/api/admin/restaurants/1/pause",
    );
    assert.deepEqual(calls[0].body, { until: "endOfService" });
    assert.match(lines.join("\n"), /2026-11-06T22:00:00Z/);
  });

  test("--minutes still sends the minute count", async () => {
    const { fetch, calls } = fakeFetch(() => ({
      status: 200,
      body: { message: "ok", bookingsPausedUntil: "2026-11-06T19:30:00Z" },
    }));
    globalThis.fetch = fetch;

    await run(["locations", "pause", "1", "--minutes", "90"]);

    assert.deepEqual(calls[0].body, { minutes: 90 });
  });

  test("with neither flag it fails before any request", async () => {
    const { fetch, calls } = fakeFetch(() => ({ status: 200, body: {} }));
    globalThis.fetch = fetch;

    const lines = await run(["locations", "pause", "1"]);

    assert.equal(calls.length, 0);
    assert.match(lines.join("\n"), /exactly one of --minutes/);
    assert.equal(takeExitCode(), 1);
  });

  test("with both flags it fails before any request", async () => {
    const { fetch, calls } = fakeFetch(() => ({ status: 200, body: {} }));
    globalThis.fetch = fetch;

    const lines = await run([
      "locations",
      "pause",
      "1",
      "--minutes",
      "30",
      "--rest-of-today",
    ]);

    assert.equal(calls.length, 0);
    assert.match(lines.join("\n"), /exactly one of --minutes/);
    assert.equal(takeExitCode(), 1);
  });

  test("--json prints the raw response", async () => {
    const { fetch } = fakeFetch(() => ({
      status: 200,
      body: { message: "ok", bookingsPausedUntil: "2026-11-06T22:00:00Z" },
    }));
    globalThis.fetch = fetch;

    const lines = await run([
      "locations",
      "pause",
      "1",
      "--rest-of-today",
      "--json",
    ]);

    assert.deepEqual(JSON.parse(lines.join("\n")), {
      message: "ok",
      bookingsPausedUntil: "2026-11-06T22:00:00Z",
    });
  });
});

describe("locations update", () => {
  /**
   * The PUT assigns name, address, both caps and the four limits unconditionally, so a body
   * missing one would clear it: the command fetches the record and sends those back as found.
   */
  test("merges the flags onto the fetched record and sends the current name, address and caps", async () => {
    const { fetch, calls } = readModifyWriteFetch();
    globalThis.fetch = fetch;

    const lines = await run([
      "locations",
      "update",
      "1",
      "--max-party",
      "10",
      "--min-notice",
      "120",
    ]);

    assert.equal(calls.length, 2);
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://cli.example/api/restaurants/1");
    assert.equal(calls[1].method, "PUT");
    assert.equal(calls[1].url, "https://cli.example/api/restaurants/1");
    assert.deepEqual(calls[1].body, {
      ...CARRIED,
      minBookingNoticeMinutes: 120,
      maxOnlinePartySize: 10,
    });
    assert.ok(!("dateExceptions" in (calls[1].body as object)));
    assert.ok(!("openTime" in (calls[1].body as object)));
    const output = lines.join("\n");
    assert.match(output, /maxOnlinePartySize\s+10/);
    assert.match(output, /minBookingNoticeMinutes\s+120/);
  });

  test("the literal none clears a limit", async () => {
    const { fetch, calls } = readModifyWriteFetch();
    globalThis.fetch = fetch;

    await run(["locations", "update", "1", "--max-days-ahead", "none"]);

    assert.deepEqual(calls[1].body, { ...CARRIED, maxBookingDaysAhead: null });
  });

  test("with no limit flag it fails before any request", async () => {
    const { fetch, calls } = readModifyWriteFetch();
    globalThis.fetch = fetch;

    const lines = await run(["locations", "update", "1"]);

    assert.equal(calls.length, 0);
    assert.match(lines.join("\n"), /Nothing to change/);
    assert.equal(takeExitCode(), 1);
  });

  test("a non-numeric limit fails before any request", async () => {
    const { fetch, calls } = readModifyWriteFetch();
    globalThis.fetch = fetch;

    const lines = await run(["locations", "update", "1", "--min-party", "two"]);

    assert.equal(calls.length, 0);
    assert.match(lines.join("\n"), /--min-party must be a whole number/);
    assert.equal(takeExitCode(), 1);
  });
});

describe("locations dates", () => {
  test("list prints the location's date exceptions as a table", async () => {
    const { fetch, calls } = readModifyWriteFetch();
    globalThis.fetch = fetch;

    const lines = await run(["locations", "dates", "list", "1"]);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "GET");
    assert.match(lines[0], /^date\s+type\s+open\s+close\s+lastBooking/);
    assert.match(lines.join("\n"), /2026-12-25\s+closed/);
    assert.match(lines.join("\n"), /2026-12-24\s+walkInOnly/);
  });

  test("add of special hours sends open, close and lastBooking under the wire type and keeps the other dates", async () => {
    const { fetch, calls } = readModifyWriteFetch();
    globalThis.fetch = fetch;

    await run([
      "locations",
      "dates",
      "add",
      "1",
      "--date",
      "2026-12-31",
      "--type",
      "special-hours",
      "--open",
      "18:00",
      "--close",
      "01:00",
      "--last-booking",
      "23:00",
    ]);

    assert.equal(calls.length, 2);
    assert.equal(calls[1].method, "PUT");
    assert.deepEqual(calls[1].body, {
      ...CARRIED,
      dateExceptions: [
        { date: "2026-12-24", type: "walkInOnly" },
        { date: "2026-12-25", type: "closed" },
        {
          date: "2026-12-31",
          type: "specialHours",
          open: "18:00",
          close: "01:00",
          lastBooking: "23:00",
        },
      ],
    });
  });

  test("add on a date already listed replaces that entry", async () => {
    const { fetch, calls } = readModifyWriteFetch();
    globalThis.fetch = fetch;

    await run([
      "locations",
      "dates",
      "add",
      "1",
      "--date",
      "2026-12-24",
      "--type",
      "closed",
    ]);

    assert.deepEqual(
      (calls[1].body as { dateExceptions: unknown }).dateExceptions,
      [
        { date: "2026-12-25", type: "closed" },
        { date: "2026-12-24", type: "closed" },
      ],
    );
  });

  test("remove drops only that date", async () => {
    const { fetch, calls } = readModifyWriteFetch();
    globalThis.fetch = fetch;

    await run(["locations", "dates", "remove", "1", "--date", "2026-12-25"]);

    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].body, {
      ...CARRIED,
      dateExceptions: [{ date: "2026-12-24", type: "walkInOnly" }],
    });
  });

  test("remove of a date not listed fails without writing", async () => {
    const { fetch, calls } = readModifyWriteFetch();
    globalThis.fetch = fetch;

    const lines = await run([
      "locations",
      "dates",
      "remove",
      "1",
      "--date",
      "2027-01-01",
    ]);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, "GET");
    assert.match(lines.join("\n"), /no date exception on 2027-01-01/);
    assert.equal(takeExitCode(), 1);
  });

  test("add of special hours without --open and --close fails before any request", async () => {
    const { fetch, calls } = readModifyWriteFetch();
    globalThis.fetch = fetch;

    const lines = await run([
      "locations",
      "dates",
      "add",
      "1",
      "--date",
      "2026-12-31",
      "--type",
      "special-hours",
      "--open",
      "18:00",
    ]);

    assert.equal(calls.length, 0);
    assert.match(lines.join("\n"), /needs both --open and --close/);
    assert.equal(takeExitCode(), 1);
  });

  test("add refuses hours on a closed date rather than dropping them silently", async () => {
    const { fetch, calls } = readModifyWriteFetch();
    globalThis.fetch = fetch;

    const lines = await run([
      "locations",
      "dates",
      "add",
      "1",
      "--date",
      "2026-12-25",
      "--type",
      "closed",
      "--open",
      "18:00",
    ]);

    assert.equal(calls.length, 0);
    assert.match(lines.join("\n"), /special-hours only/);
    assert.equal(takeExitCode(), 1);
  });

  test("add rejects an unknown type and a malformed date before any request", async () => {
    const { fetch, calls } = readModifyWriteFetch();
    globalThis.fetch = fetch;

    const typeLines = await run([
      "locations",
      "dates",
      "add",
      "1",
      "--date",
      "2026-12-25",
      "--type",
      "holiday",
    ]);
    assert.match(typeLines.join("\n"), /--type must be one of/);
    assert.equal(takeExitCode(), 1);

    const dateLines = await run([
      "locations",
      "dates",
      "add",
      "1",
      "--date",
      "25/12/2026",
      "--type",
      "closed",
    ]);
    assert.match(dateLines.join("\n"), /YYYY-MM-DD/);
    assert.equal(takeExitCode(), 1);

    assert.equal(calls.length, 0);
  });

  test("--json prints the resulting list", async () => {
    const { fetch } = readModifyWriteFetch();
    globalThis.fetch = fetch;

    const lines = await run([
      "locations",
      "dates",
      "remove",
      "1",
      "--date",
      "2026-12-25",
      "--json",
    ]);

    assert.deepEqual(JSON.parse(lines.join("\n")), [
      { date: "2026-12-24", type: "walkInOnly" },
    ]);
  });
});
