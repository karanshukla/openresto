import type { RefObject } from "react";
import { findNodeHandle, Platform } from "react-native";
import type { ScrollView, View } from "react-native";

export interface ScrollIntoViewOptions {
  block?: "start" | "center" | "nearest";
  /**
   * `false` lands on the target in one frame. A list positioning itself at its current value
   * wants that: animating there scrolls visibly through every row in between, which on a
   * fifty-row picker reads as the control running away from the press.
   */
  animated?: boolean;
}

/**
 * Cross-platform scroll-to-element: on web, calls the DOM `scrollIntoView`;
 * on native, measures the target against the enclosing ScrollView and scrolls
 * to it manually. Callers own the trigger condition and delay (layout needs
 * to settle first — see call sites for the ~150ms setTimeout pattern) since
 * those differ per usage; this only wraps the actual cross-platform scroll
 * mechanics so they can't drift between call sites. See CLAUDE.md's
 * "Cross-platform scroll-to-element" note.
 *
 * @see [scrollIntoView.test.ts](../tests/utils/scrollIntoView.test.ts) — pins that `animated`
 * picks the instant path on both platforms.
 */
export function scrollIntoView(
  targetRef: RefObject<View | null>,
  scrollRef: RefObject<ScrollView | null>,
  { block = "start", animated = true }: ScrollIntoViewOptions = {}
) {
  if (!targetRef.current) return;
  if (Platform.OS === "web") {
    (targetRef.current as unknown as HTMLElement).scrollIntoView?.({
      behavior: animated ? "smooth" : "instant",
      block,
    });
  } else {
    const node = findNodeHandle(scrollRef.current);
    if (!node) return;
    targetRef.current.measureLayout(
      node,
      (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated }),
      () => {}
    );
  }
}
