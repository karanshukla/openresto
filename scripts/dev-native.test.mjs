import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { concurrentlyEntry, lanAddress } from "./dev-native.mjs";

const wifi = { family: "IPv4", internal: false, address: "192.168.50.239" };
const loopback = { family: "IPv4", internal: true, address: "127.0.0.1" };
const hyperV = { family: "IPv4", internal: false, address: "172.29.64.1" };

const manifestIn = (bin) => {
  const path = join(mkdtempSync(join(tmpdir(), "dev-native-")), "package.json");
  writeFileSync(path, JSON.stringify({ name: "concurrently", bin }));
  return path;
};

describe("lanAddress", () => {
  it("takes the address a phone on the same network can route to", () => {
    assert.equal(lanAddress({ "Wi-Fi": [wifi] }), "192.168.50.239");
  });

  it("skips a Hyper-V bridge holding a routable-looking address", () => {
    const interfaces = { "vEthernet (WSL)": [hyperV], "Wi-Fi": [wifi] };
    assert.equal(lanAddress(interfaces), "192.168.50.239");
  });

  it("reports nothing rather than an address only this host is on", () => {
    const interfaces = {
      "Loopback Pseudo-Interface 1": [loopback],
      "vEthernet (Default Switch)": [hyperV],
    };
    assert.equal(lanAddress(interfaces), null);
  });
});

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
