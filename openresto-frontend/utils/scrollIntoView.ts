import type { RefObject } from "react";
import { Platform } from "react-native";
import type { ScrollView, View } from "react-native";

/**
 * `ScrollView`'s content view, which its own type declarations omit — the `getInnerViewNode`
 * they do declare returns the node handle the New Architecture no longer accepts.
 */
type ScrollViewContent = {
  getInnerViewRef?: () => Parameters<View["measureLayout"]>[0] | null;
};

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
    /**
     * Measured against the *content* view, so `y` is an offset into the scrollable content.
     * The scroll view itself would give a viewport position, which moves as the list scrolls
     * and lands somewhere different depending on where the user already was.
     */
    const content = (scrollRef.current as unknown as ScrollViewContent | null)?.getInnerViewRef?.();
    if (!content) return;
    targetRef.current.measureLayout(
      content,
      (_x, y) => scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated }),
      () => {}
    );
  }
}
