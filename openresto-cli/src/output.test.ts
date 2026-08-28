import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { printResult } from "./output.js";

function captureConsoleLog(fn: () => void): string[] {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    fn();
  } finally {
    console.log = original;
  }
  return lines;
}

describe("printResult", () => {
  test("json mode prints valid, pretty-printed JSON of the exact data", () => {
    const lines = captureConsoleLog(() =>
      printResult({ id: 1, name: "A" }, true),
    );

    const parsed = JSON.parse(lines.join("\n"));
    assert.deepEqual(parsed, { id: 1, name: "A" });
  });

  test("table mode on an array renders a header row and one row per item", () => {
    const lines = captureConsoleLog(() =>
      printResult(
        [
          { id: 1, name: "A" },
          { id: 2, name: "B" },
        ],
        false,
      ),
    );

    assert.match(lines[0], /id/);
    assert.match(lines[0], /name/);
    assert.match(lines[2], /1/);
    assert.match(lines[2], /A/);
    assert.match(lines[3], /2/);
    assert.match(lines[3], /B/);
  });

  test("table mode on an empty array prints a placeholder instead of an empty table", () => {
    const lines = captureConsoleLog(() => printResult([], false));

    assert.deepEqual(lines, ["(no results)"]);
  });

  test("table mode restricts to explicit columns when given", () => {
    const lines = captureConsoleLog(() =>
      printResult([{ id: 1, name: "A", secret: "shh" }], false, ["id", "name"]),
    );

    assert.doesNotMatch(lines[0], /secret/);
    assert.doesNotMatch(lines[2], /shh/);
  });

  test("table mode on a single object (not an array) prints a key/value record", () => {
    const lines = captureConsoleLog(() =>
      printResult({ id: 1, name: "A" }, false),
    );

    assert.ok(lines.some((l) => l.includes("id") && l.includes("1")));
    assert.ok(lines.some((l) => l.includes("name") && l.includes("A")));
  });

  test("table mode on undefined prints a no-content placeholder rather than throwing", () => {
    const lines = captureConsoleLog(() => printResult(undefined, false));

    assert.deepEqual(lines, ["(no content)"]);
  });

  test("nested object values are rendered as inline JSON, not [object Object]", () => {
    const lines = captureConsoleLog(() =>
      printResult([{ id: 1, meta: { a: 1 } }], false),
    );

    assert.match(lines[2], /\{"a":1\}/);
  });
});
