#!/usr/bin/env node
/**
 * Asserts that every inline <script> in the web export is pinned by hash in the nginx CSP.
 *
 * The CSP has no 'unsafe-inline' for scripts, so a script the export writes inline runs only
 * if its hash is listed. Expo Router writes one into every page (the hydrate flag); an Expo
 * upgrade that changes it, or a new inline script, would otherwise be blocked in production
 * with nothing failing here.
 *
 *   node scripts/check-csp.mjs            # export, then check
 *   node scripts/check-csp.mjs --no-build # reuse an existing dist/
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(root, "dist");
const policies = ["nginx", "nginx-vps"].flatMap((dir) =>
  ["security-headers.conf", "embed-headers.conf"].map((file) => join(root, "..", dir, file))
);

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

if (!process.argv.includes("--no-build")) {
  execFileSync("npx", ["expo", "export", "-p", "web", "--clear"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

if (!existsSync(distDir)) {
  console.error("No dist/ directory — run without --no-build.");
  process.exit(1);
}

const inline = new Map();
for (const file of walk(distDir).filter((f) => f.endsWith(".html"))) {
  for (const [, body] of readFileSync(file, "utf8").matchAll(
    /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g
  )) {
    inline.set("sha256-" + createHash("sha256").update(body).digest("base64"), body.slice(0, 80));
  }
}

let failed = false;
for (const policy of policies) {
  const text = readFileSync(policy, "utf8");
  if (/script-src[^;"]*'unsafe-(inline|eval)'/.test(text)) {
    console.error(`${policy}: script-src allows unsafe-inline or unsafe-eval.`);
    failed = true;
  }
  for (const [hash, body] of inline) {
    if (!text.includes(`'${hash}'`)) {
      console.error(`${policy}: no 'script-src' hash for the inline script "${body}" (${hash}).`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log(`Inline scripts in the export (${inline.size}) are all pinned in the CSP.`);
