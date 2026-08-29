import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Command } from "commander";
import { registerEmailCommands } from "./email.js";
import { registerStatusCommand } from "./status.js";

function buildProgram(): Command {
  const program = new Command();
  program.exitOverride().option("--profile <name>").option("--json");
  registerStatusCommand(program);
  registerEmailCommands(program);
  return program;
}

interface Recorded {
  url: string;
  method: string;
}

function recordingFetch(body: unknown, recorded: Recorded[]): typeof fetch {
  return (async (input: string, init?: { method?: string }) => {
    recorded.push({ url: String(input), method: init?.method ?? "GET" });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

function captureLogs(): { lines: string[]; restore: () => void } {
  const lines: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => lines.push(args.map(String).join(" "));
  return {
    lines,
    restore: () => {
      console.log = originalLog;
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

describe("email status", () => {
  test("reads the status endpoint, not the credential surface", async () => {
    const recorded: Recorded[] = [];
    globalThis.fetch = recordingFetch(
      { isConfigured: true, sendBookingConfirmations: false },
      recorded,
    );
    const { restore } = captureLogs();

    try {
      await buildProgram().parseAsync(["email", "status"], { from: "user" });
    } finally {
      restore();
    }

    assert.equal(recorded.length, 1);
    assert.equal(
      recorded[0].url,
      "https://cli.example/api/admin/email-settings/status",
    );
  });

  test("shows configured and confirmations separately, since one can be on without the other", async () => {
    globalThis.fetch = recordingFetch(
      { isConfigured: true, sendBookingConfirmations: false, fromEmail: null },
      [],
    );
    const { lines, restore } = captureLogs();

    try {
      await buildProgram().parseAsync(["email", "status"], { from: "user" });
    } finally {
      restore();
    }

    const output = lines.join("\n");
    assert.match(output, /isConfigured\s+true/);
    assert.match(output, /sendBookingConfirmations\s+false/);
  });
});

describe("email failures", () => {
  test("renders a redacted recipient as a blank cell rather than failing", async () => {
    globalThis.fetch = recordingFetch(
      [
        {
          id: 1,
          bookingRef: "ABC123",
          recipientEmail: null,
          errorMessage: "connect timeout",
          attemptedAt: "2026-08-29T10:00:00Z",
        },
      ],
      [],
    );
    const { lines, restore } = captureLogs();

    try {
      await buildProgram().parseAsync(["email", "failures"], { from: "user" });
    } finally {
      restore();
    }

    const output = lines.join("\n");
    assert.match(output, /ABC123/);
    assert.match(output, /connect timeout/);
    assert.doesNotMatch(output, /null/);
  });
});

describe("status", () => {
  test("reads the admin overview", async () => {
    const recorded: Recorded[] = [];
    globalThis.fetch = recordingFetch({ totalBookings: 3 }, recorded);
    const { restore } = captureLogs();

    try {
      await buildProgram().parseAsync(["status"], { from: "user" });
    } finally {
      restore();
    }

    assert.equal(recorded[0].url, "https://cli.example/api/admin/overview");
    assert.equal(recorded[0].method, "GET");
  });
});
