import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readJsonInput, omitUndefined } from "./io.js";

describe("omitUndefined", () => {
  test("drops keys whose value is undefined", () => {
    const result = omitUndefined({ a: 1, b: undefined, c: "x" });

    assert.deepEqual(result, { a: 1, c: "x" });
  });

  test("keeps falsy-but-defined values like empty string, zero, and false", () => {
    const result = omitUndefined({ a: "", b: 0, c: false });

    assert.deepEqual(result, { a: "", b: 0, c: false });
  });

  test("an all-undefined input produces an empty object", () => {
    const result = omitUndefined({ a: undefined, b: undefined });

    assert.deepEqual(result, {});
  });
});

describe("readJsonInput", () => {
  test("reads and parses JSON from a file path", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "openresto-cli-io-test-"));
    try {
      const file = path.join(dir, "body.json");
      writeFileSync(file, JSON.stringify({ appName: "Test" }));

      const result = await readJsonInput(file);

      assert.deepEqual(result, { appName: "Test" });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("throws a readable error for malformed JSON in a file", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "openresto-cli-io-test-"));
    try {
      const file = path.join(dir, "bad.json");
      writeFileSync(file, "{not json");

      await assert.rejects(() => readJsonInput(file), /Could not parse JSON/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
