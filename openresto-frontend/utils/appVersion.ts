import Constants from "expo-constants";

/**
 * The dotted numbers of a version, missing or non-numeric segments read as 0, so "1.9" and
 * "1.9.0" compare equal and a store's build suffix never makes a version look older.
 */
function segments(version: string): number[] {
  return version.split(".").map((part) => {
    const parsed = Number.parseInt(part, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  });
}

/**
 * Orders two `major.minor.patch` versions: negative if `a` is older, 0 if they name the same
 * version, positive if `a` is newer.
 *
 * @see [appVersion.test.ts](../tests/utils/appVersion.test.ts) — pins that equal versions pass
 * and that one patch below fails, on both sides of the boundary.
 */
export function compareVersions(a: string, b: string): number {
  const left = segments(a);
  const right = segments(b);
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  return 0;
}

/**
 * Whether a running build is older than the minimum the server asks for. An absent minimum, or
 * an unknown running version, is never below it: the gate locks the whole app out of booking,
 * so anything it cannot establish resolves to "let them through".
 *
 * @see [appVersion.test.ts](../tests/utils/appVersion.test.ts) — pins both open cases.
 */
export function isBelowMinimum(current: string | undefined, minimum: string | undefined): boolean {
  if (!minimum || !current) return false;
  return compareVersions(current, minimum) < 0;
}

/** The version baked into the binary by `app.config.ts` — the OpenResto release it was cut from. */
export function currentAppVersion(): string | undefined {
  return Constants.expoConfig?.version ?? undefined;
}
