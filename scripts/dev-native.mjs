#!/usr/bin/env node
/**
 * `npm run dev:native` — the dev stack addressed the way a phone can reach it.
 *
 * `npm run dev` is for a browser on this machine, so `openresto-frontend/.env` points the
 * app at `http://localhost:8080`. In Expo Go `localhost` is the phone, so the app resolves
 * it to itself, reaches no API at all, and fails in whatever way the first request does.
 * This resolves the machine's LAN address instead and hands it to Metro, which bakes
 * `EXPO_PUBLIC_API_URL` into the bundle at build time.
 *
 * `@expo/env` skips any key already present in the system environment, so passing it here
 * wins over the `.env` file rather than racing it.
 */
import { networkInterfaces } from "node:os";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

/**
 * Bridges and tunnels that hold a routable-looking address the phone can still never reach.
 * Docker and podman are the ones that actually bite: bring the compose stack up and their
 * `172.x` bridge appears alongside the real wifi address, so an unfiltered "first non-internal
 * IPv4" picks a network only this host is on, and the app fails exactly as it does with
 * localhost.
 */
const UNREACHABLE_INTERFACE =
  /^(lo|docker|podman|cni|br-|veth|virbr|vmnet|vboxnet|tun|tap|utun|wg|tailscale|zt)/i;

/** The address a device on the same network can route to, or null if only virtual ones are up. */
export function lanAddress(interfaces = networkInterfaces()) {
  for (const [name, addresses] of Object.entries(interfaces)) {
    if (UNREACHABLE_INTERFACE.test(name)) continue;
    for (const address of addresses ?? []) {
      const isIpv4 = address.family === "IPv4" || address.family === 4;
      if (isIpv4 && !address.internal) return address.address;
    }
  }
  return null;
}

const DEFAULT_API_PORT = "8080";

/**
 * The `concurrently` CLI entry point, resolved through the package rather than through
 * `node_modules/.bin`. npm writes three shims per tool there and only the extensionless
 * POSIX one carries the bare name, so spawning it fails with ENOENT on Windows; the `.cmd`
 * beside it cannot be spawned without `shell: true`, which would then have to quote the
 * space-bearing command arguments below. Handing the entry to `process.execPath` avoids
 * both. `exports` blocks the `dist/bin` subpath but allows `package.json`, so the location
 * comes from the manifest's own `bin` field rather than a hardcoded path into the package.
 */
export function concurrentlyEntry(
  manifest = createRequire(import.meta.url).resolve(
    "concurrently/package.json",
  ),
) {
  const { bin } = JSON.parse(readFileSync(manifest, "utf8"));
  return resolve(
    dirname(manifest),
    typeof bin === "string" ? bin : bin.concurrently,
  );
}

function main() {
  const host = process.env.OPENRESTO_LAN_HOST || lanAddress();
  if (!host) {
    console.error(
      "dev:native: no LAN address found — every interface up is loopback or a virtual bridge.\n" +
        "Connect to the same network as the phone, or set OPENRESTO_LAN_HOST to this machine's address.",
    );
    process.exit(1);
  }

  const port = process.env.OPENRESTO_API_PORT || DEFAULT_API_PORT;
  const apiUrl = `http://${host}:${port}`;

  let entry;
  try {
    entry = concurrentlyEntry();
  } catch {
    console.error("dev:native: concurrently is not installed.");
    console.error("dev:native: run npm install at the repository root first.");
    process.exit(1);
  }

  console.log(`dev:native: serving the app against ${apiUrl}`);
  console.log(
    "dev:native: the phone must be on this network; add --clear if Metro looks stale.\n",
  );

  const child = spawn(
    process.execPath,
    [
      entry,
      "--kill-others",
      "--kill-timeout",
      "5000",
      "--names",
      "api,fe",
      "--prefix-colors",
      "cyan,magenta",
      "dotnet watch --project OpenRestoApi",
      "npm run dev --prefix openresto-frontend",
    ],
    { stdio: "inherit", env: { ...process.env, EXPO_PUBLIC_API_URL: apiUrl } },
  );

  child.on("error", (error) => {
    console.error(
      `dev:native: could not start concurrently (${error.message}).`,
    );
    process.exit(1);
  });
  child.on("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
}

// Importing this module must not launch the stack — `lanAddress` is worth reading on its own.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
