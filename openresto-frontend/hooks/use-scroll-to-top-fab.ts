import { useCallback, useMemo, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { SHOW_AFTER_SCROLL_Y } from "@/components/common/ScrollToTopFab";

/**
 * Drives the scroll-to-top FAB: it is offered once the scroll is far enough down to be worth
 * undoing, and from then to the end of the page.
 *
 * It used to stand down over the footer, and before that to climb over it — rising as the footer
 * came into view so as not to sit on its links. Both were wrong. The climb meant an element that
 * reads as pinned sliding the footer's height up the page on every scroll near the bottom, driven
 * by a value that changed on every scroll event: the judder in #399. Standing down instead took
 * the shortcut away at the bottom of the page, which is exactly where it is most wanted. Neither
 * was needed: the FAB sits in the gutter beside the content column, and the footer's own row ends
 * on that same edge, so they never overlapped in the first place.
 *
 * Visibility is the only thing a scroll changes here, and it changes twice in a scroll rather than
 * continuously — so this hook, which the *screen* calls, re-renders the page twice rather than on
 * every scroll event. That matters more than it looks: react-native-web reads
 * `scrollEventThrottle` only to decide whether to warn and never throttles, so anything held here
 * that tracks the scroll position re-renders every card on the page several times a frame.
 *
 * @see [use-scroll-to-top-fab.test.tsx](../tests/hooks/use-scroll-to-top-fab.test.tsx) — pins that
 * it holds to the end of the scroll, and that a gesture's worth of positions renders the screen
 * once rather than once each.
 */
export function useScrollToTopFab() {
  const [visible, setVisible] = useState(false);

  const trackScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Same value as last time is a no-op in React, so this renders only on the crossing.
    setVisible(e.nativeEvent.contentOffset.y > SHOW_AFTER_SCROLL_Y);
  }, []);

  // Stable, so a screen wrapping `trackScroll` in its own handler does not hand the ScrollView a
  // new onScroll every render.
  return useMemo(() => ({ visible, trackScroll }), [visible, trackScroll]);
}
