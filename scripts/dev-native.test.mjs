import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { concurrentlyEntry } from "./dev-native.mjs";

const manifestIn = (bin) => {
  const path = join(mkdtempSync(join(tmpdir(), "dev-native-")), "package.json");
  writeFileSync(path, JSON.stringify({ name: "concurrently", bin }));
  return path;
};

/**
 * LAN address resolution is not tested here on purpose: it is the frontend's
 * scripts/lib/expo-go.mjs, pinned by tests/scripts/expo-go.test.ts. A second set of
 * assertions against a second implementation is what this script used to have.
 */

/**
 * The stack is spawned with `process.execPath`, so the entry has to be a file node can run
 * on every platform. `node_modules/.bin/concurrently` is not: npm writes the bare name
 * there as a POSIX sh shim, which Windows cannot execute, and the `.cmd` beside it needs a
 * shell that would then have to quote the space-bearing arguments the stack is launched
 * with. Spawning the shim is what broke `npm run dev:native` on Windows while it kept
 * working on Linux, and it surfaced as an ENOENT that read like a missing install.
 */
describe("concurrentlyEntry", () => {
  it("resolves a real javascript file, not a node_modules/.bin shim", () => {
    const entry = concurrentlyEntry();
    assert.ok(entry.endsWith(".js"), `${entry} is not a javascript file`);
    assert.ok(!entry.includes(`${sep}.bin${sep}`), `${entry} is a bin shim`);
    assert.ok(existsSync(entry), `${entry} does not exist`);
  });

  it("reads the entry off the manifest's bin map", () => {
    const manifest = manifestIn({ concurrently: "./dist/bin/concurrently.js" });
    const expected = join(manifest, "..", "dist", "bin", "concurrently.js");
    assert.equal(concurrentlyEntry(manifest), expected);
  });

  it("reads a single-command bin declared as a bare string", () => {
    const manifest = manifestIn("./cli.js");
    assert.equal(concurrentlyEntry(manifest), join(manifest, "..", "cli.js"));
  });
});
