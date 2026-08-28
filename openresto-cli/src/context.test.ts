import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { printError, handle } from "./context.js";
import { ApiError } from "./transport.js";

function captureConsoleError(fn: () => void): string[] {
  const lines: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    fn();
  } finally {
    console.error = original;
  }
  return lines;
}

describe("printError", () => {
  test("renders an ApiError with its status and server message", () => {
    const lines = captureConsoleError(() =>
      printError(
        new ApiError(
          404,
          "No booking found matching that reference and email.",
          "booking.lookup_not_found",
        ),
      ),
    );

    assert.match(lines[0], /404/);
    assert.match(lines[0], /booking\.lookup_not_found/);
    assert.match(lines[0], /No booking found/);
  });

  test("renders an ApiError with no code without printing 'undefined'", () => {
    const lines = captureConsoleError(() =>
      printError(new ApiError(500, "boom")),
    );

    assert.doesNotMatch(lines[0], /undefined/);
  });

  test("renders a plain Error's message", () => {
    const lines = captureConsoleError(() =>
      printError(new Error("A server URL is required.")),
    );

    assert.match(lines[0], /A server URL is required\./);
  });

  test("renders a non-Error thrown value without crashing", () => {
    const lines = captureConsoleError(() => printError("just a string"));

    assert.ok(lines.length > 0);
  });
});

describe("handle", () => {
  test("a successful action leaves exitCode untouched", async () => {
    const original = process.exitCode;
    process.exitCode = undefined;
    const action = handle(async (..._args: unknown[]) => {});

    await action({}, {});

    assert.equal(process.exitCode, undefined);
    process.exitCode = original;
  });

  test("a thrown error is caught, printed, and sets exit code 1 instead of propagating", async () => {
    const original = process.exitCode;
    process.exitCode = undefined;
    const action = handle(async (..._args: unknown[]) => {
      throw new Error("nope");
    });

    const originalConsoleError = console.error;
    const lines: string[] = [];
    console.error = (...args: unknown[]) =>
      lines.push(args.map(String).join(" "));
    try {
      await assert.doesNotReject(() => action({}, {}));
    } finally {
      console.error = originalConsoleError;
    }

    assert.equal(process.exitCode, 1);
    assert.match(lines[0], /nope/);
    process.exitCode = original;
  });
});
