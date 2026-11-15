import type { RefObject } from "react";
import type { TextInputInstance } from "react-native";

export type FocusTargetKey = "admin-lookup" | "user-lookup";

const registry: Partial<Record<FocusTargetKey, RefObject<TextInputInstance | null>>> = {};

// A focusTarget() call for a screen that isn't mounted yet (e.g. right after
// router.push() to that screen — the registration effect hasn't run on the
// next render yet) records the request here so registerFocusTarget can
// fulfil it as soon as the target actually mounts, instead of silently
// missing it.
let pendingFocusKey: FocusTargetKey | null = null;

export function registerFocusTarget(key: FocusTargetKey, ref: RefObject<TextInputInstance | null>) {
  registry[key] = ref;
  if (pendingFocusKey === key) {
    pendingFocusKey = null;
    ref.current?.focus();
  }
}

export function unregisterFocusTarget(key: FocusTargetKey) {
  delete registry[key];
}

export function focusTarget(key: FocusTargetKey) {
  const ref = registry[key];
  if (ref?.current) {
    ref.current.focus();
    return;
  }
  pendingFocusKey = key;
}
