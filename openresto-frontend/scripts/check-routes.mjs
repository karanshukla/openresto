#!/usr/bin/env node
/**
 * Asserts the app's route tree against a checked-in snapshot.
 *
 * Expo Router derives routes from the filesystem under `app/`, so a file that is not
 * meant to be a route still becomes one — and a file whose name matches a routing
 * convention can restructure the tree without any other signal. A `<Screen>.styles.ts`
 * placed next to its screen added phantom routes, and `app/admin/_layout.styles.ts` was
 * loaded as a *layout*, re-parenting every admin route under
 * `/admin/_layout.styles/...` so `/admin/dashboard` stopped existing.
 *
 * Nothing else catches that class of change: tsc, Jest and lint were all green with the
 * tree in that state, and only an end-to-end run against real routing failed. Routes are
 * public URLs, so changing one should be deliberate — this makes it an explicit snapshot
 * update rather than a silent side effect.
 *
 *   node scripts/check-routes.mjs            # export, then compare against the snapshot
 *   node scripts/check-routes.mjs --update   # accept the current tree as the snapshot
 *   node scripts/check-routes.mjs --no-build # reuse an existing dist/
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(root, "dist");
const snapshotPath = join(root, "routes.snapshot.txt");

const update = process.argv.includes("--update");
const skipBuild = process.argv.includes("--no-build");

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** The static web export writes one HTML file per route, which is the route tree. */
function exportedRoutes() {
  return walk(distDir)
    .filter((f) => f.endsWith(".html"))
    .map(
      (f) =>
        "/" +
        relative(distDir, f)
          .replace(/\\/g, "/")
          .replace(/\.html$/, "")
    )
    .sort();
}

if (!skipBuild) {
  console.log("Exporting web build to derive the route tree…");
  // npm installs `npx` on Windows as `npx.cmd`, which CreateProcess will not run under the
  // bare name — without a shell this fails with ENOENT that reads like a missing install.
  // These arguments carry no spaces, so letting the shell re-parse them is safe here.
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

const actual = exportedRoutes();

if (update) {
  writeFileSync(snapshotPath, actual.join("\n") + "\n");
  console.log(`Updated ${relative(root, snapshotPath)} with ${actual.length} routes.`);
  process.exit(0);
}

if (!existsSync(snapshotPath)) {
  console.error(`Missing ${relative(root, snapshotPath)}. Create it with --update.`);
  process.exit(1);
}

const expected = readFileSync(snapshotPath, "utf8").split("\n").filter(Boolean);
const added = actual.filter((r) => !expected.includes(r));
const removed = expected.filter((r) => !actual.includes(r));

if (!added.length && !removed.length) {
  console.log(`Route tree matches the snapshot (${actual.length} routes).`);
  process.exit(0);
}

console.error("\nRoute tree does not match routes.snapshot.txt.\n");
for (const r of removed) console.error(`  - ${r}`);
for (const r of added) console.error(`  + ${r}`);
console.error(
  [
    "",
    "If you intended to change the app's routes, re-run with --update and commit the snapshot.",
    "",
    "If you did not, a file under app/ is being treated as a route. Every module there is",
    "one — move helpers (styles, constants, utilities) outside app/. Watch for names matching",
    "a routing convention: anything called _layout* is loaded as a layout and will re-parent",
    "its sibling routes.",
    "",
  ].join("\n")
);
process.exit(1);
