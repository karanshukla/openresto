import { readFileSync } from "node:fs";
import { readAllStdin } from "./prompt.js";

/** Reads JSON from a file path, or from stdin when given `-` — used by `--from-json`. */
export async function readJsonInput(pathOrDash: string): Promise<unknown> {
  const raw =
    pathOrDash === "-"
      ? await readAllStdin()
      : readFileSync(pathOrDash, "utf8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    const source = pathOrDash === "-" ? "stdin" : pathOrDash;
    throw new Error(
      `Could not parse JSON from ${source}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Drops undefined values so a flags-built request body only sends fields the caller set. */
export function omitUndefined<T extends Record<string, unknown>>(
  obj: T,
): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}
