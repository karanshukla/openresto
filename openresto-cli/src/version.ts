import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * The CLI's own version, read from package.json at runtime rather than a hardcoded string that
 * would drift from it. The CLI is versioned in lockstep with OpenResto
 * (scripts/check-release-version.sh enforces this), so this is the one place that reads it off
 * disk — index.ts (for `--version`) and the auth commands' server/CLI mismatch check both call
 * this instead of duplicating the read.
 */
export function getCliVersion(): string {
  const packageDir = path.dirname(fileURLToPath(import.meta.url));
  const { version } = JSON.parse(
    readFileSync(path.join(packageDir, "..", "package.json"), "utf-8"),
  ) as { version: string };
  return version;
}
