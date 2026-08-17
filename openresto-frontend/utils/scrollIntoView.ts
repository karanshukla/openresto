import type { RefObject } from "react";
import { findNodeHandle, Platform } from "react-native";
import type { ScrollView, View } from "react-native";

/**
 * Cross-platform scroll-to-element: on web, calls the DOM `scrollIntoView`;
 * on native, measures the target against the enclosing ScrollView and scrolls
 * to it manually. Callers own the trigger condition and delay (layout needs
 * to settle first — see call sites for the ~150ms setTimeout pattern) since
 * those differ per usage; this only wraps the actual cross-platform scroll
 * mechanics so they can't drift between call sites. See CLAUDE.md's
 * "Cross-platform scroll-to-element" note.
 */
export function scrollIntoView(
  targetRef: RefObject<View | null>,
  scrollRef: RefObject<ScrollView | null>,
  block: "start" | "center" | "nearest" = "start"
) {
  if (!targetRef.current) return;
  if (Platform.OS === "web") {
    (targetRef.current as unknown as HTMLElement).scrollIntoView?.({
      behavior: "smooth",
      block,
    });
  } else {
    const node = findNodeHandle(scrollRef.current);
    if (!node) return;
    targetRef.current.measureLayout(
      node,
      (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true }),
      () => {}
    );
  }
}
