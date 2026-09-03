import { Platform } from "react-native";
import * as QuickActions from "expo-quick-actions";
import { MY_BOOKING_ACTION_ID } from "@/constants/quickActions";
import type { QuickActionOptions } from "./quickActions";

export type { QuickActionOptions } from "./quickActions";

/**
 * SF Symbols are iOS-only by Apple's licence, so Android gets no icon and falls back to the
 * app icon. `ticket` matches the glyph `GuestTabs` gives the same destination. Resolved per
 * call rather than captured at module load, which would freeze whichever platform imported it
 * first.
 */
function icon(): string | undefined {
  return Platform.OS === "ios" ? "symbol:ticket" : undefined;
}

/**
 * The action the app was cold-started from, if any.
 *
 * Read off the namespace defensively rather than imported by name: `initial` is exported by
 * expo-quick-actions' native build and **not** by its web one, so a static named import is a
 * reference that does not exist in every build of the package it comes from.
 */
function initialAction(): { id?: string } | undefined {
  return (QuickActions as { initial?: { id?: string } }).initial;
}

/**
 * Whether the action that launched this process has been acted on. `QuickActions.initial` is a
 * snapshot taken at launch and never cleared, so without this a remount would navigate the
 * guest back to the lookup screen long after they had moved on.
 */
let handledInitialAction = false;

/** Test seam: the module-level latch above outlives a Jest module registry reset. */
export function resetInitialActionForTests(): void {
  handledInitialAction = false;
}

/**
 * @see [quickActions.native.test.ts](../tests/services/quickActions.native.test.ts) — pins the
 * cold-start launch firing once, the icon being iOS-only, and a refusing device not throwing.
 */
export function registerQuickActions({ title, onSelect }: QuickActionOptions): () => void {
  // Nothing here may throw into the layout that mounts it: a device that refuses shortcuts
  // still has to render the app.
  void QuickActions.setItems([{ id: MY_BOOKING_ACTION_ID, title, icon: icon() }]).catch(() => {});

  const subscription = QuickActions.addListener((action) => {
    if (action.id === MY_BOOKING_ACTION_ID) onSelect();
  });

  if (!handledInitialAction && initialAction()?.id === MY_BOOKING_ACTION_ID) {
    handledInitialAction = true;
    onSelect();
  }

  return () => subscription.remove();
}
