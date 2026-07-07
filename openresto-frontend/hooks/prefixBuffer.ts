// Pure prefix-buffer state machine for gopher-style two-key shortcuts (e.g. "g d").
// Extracted from useKeyboardShortcuts so the decision logic is unit-testable
// without jsdom or synthetic KeyboardEvents.
//
// The caller (the keydown handler) is responsible for the modifier/typing guards
// and for actually dispatching the resolved key against the ShortcutMap. This
// function only decides WHAT to dispatch and how the pending-prefix state should
// change.

export const GOPHER_PREFIX = "g";
export const GOPHER_TIMEOUT_MS = 1500;

export interface PrefixDecision {
  /** Key to look up in the ShortcutMap (e.g. "?" or "g d"); undefined = no dispatch. */
  dispatchKey?: string;
  /** Begin a new prefix window — caller starts the timeout. */
  startPrefix?: boolean;
  /** Clear any pending prefix — caller stops the timeout. */
  reset?: boolean;
}

/**
 * Given the current pending-prefix state and an incoming key, decide what to
 * dispatch (if anything) and how the pending state should transition.
 *
 * Three cases (mirrors the original handler logic exactly):
 *  - pending "g" + any key → dispatch "g <key>" and reset
 *  - no pending + "g"      → start a prefix window (no dispatch)
 *  - no pending + other    → dispatch the plain key
 */
export function resolvePrefixKey(pendingPrefix: string | null, key: string): PrefixDecision {
  if (pendingPrefix === GOPHER_PREFIX) {
    return { dispatchKey: `${GOPHER_PREFIX} ${key}`, reset: true };
  }
  if (key === GOPHER_PREFIX) {
    return { startPrefix: true };
  }
  return { dispatchKey: key };
}
