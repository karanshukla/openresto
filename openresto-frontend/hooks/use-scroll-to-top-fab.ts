import { useCallback, useMemo, useRef, useState } from "react";
import { Animated } from "react-native";
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fabTravel, SHOW_AFTER_SCROLL_Y } from "@/components/common/ScrollToTopFab";

/**
 * How far the FAB has to rise to stay off a footer `footerHeight` tall, with
 * `fromBottom` px of the scroll still to go. Zero until the footer starts entering the
 * viewport, then tracks it one for one, so the FAB comes to rest on the footer's top edge
 * rather than on the links in it. The footer's own height is the ceiling: a bouncing
 * scroll reports a negative distance, which would otherwise walk the FAB up the page.
 *
 * @see [use-scroll-to-top-fab.test.ts](../tests/hooks/use-scroll-to-top-fab.test.tsx) —
 * pins that it stays flat while the footer is off screen, lifts once it is not, and
 * holds at the footer's top edge through an overscroll.
 */
export function fabLift(footerHeight: number, fromBottom: number): number {
  return Math.min(footerHeight, Math.max(0, footerHeight - fromBottom));
}

/**
 * Drives the scroll-to-top FAB for a screen whose scroll ends in a `<Footer />`: when it
 * shows, and how far it has to rise to stay clear of that footer.
 *
 * `measureFooter` goes on the footer inside the scroll. A screen that takes the footer
 * back out of the scroll passes 0 through `setFooterHeight`, since the FAB then has
 * nothing to climb over.
 *
 * **The rise is an `Animated.Value`, and the footer's height is a ref, so that neither is React
 * state.** This hook is called by the screen, so state here re-renders the whole page — every
 * card, every row — and the rise changes on every scroll event for the length of the footer.
 * `scrollEventThrottle` looks like it would blunt that, but react-native-web reads the prop only
 * to decide whether to warn and never throttles, so the screen was re-rendering several times a
 * frame at the one moment the user is watching something move. Writing an `Animated.Value`
 * updates the node's transform without rendering at all. `visible` stays state deliberately: it
 * flips twice in a scroll, and it adds and removes a child.
 *
 * @see [use-scroll-to-top-fab.test.ts](../tests/hooks/use-scroll-to-top-fab.test.tsx) — pins that
 * scrolling past the footer moves the rise without re-rendering the screen that owns it.
 */
export function useScrollToTopFab() {
  const [visible, setVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const travel = useRef(new Animated.Value(0)).current;
  const footerHeight = useRef(0);

  const setFooterHeight = useCallback((height: number) => {
    footerHeight.current = height;
  }, []);

  const measureFooter = useCallback(
    (e: LayoutChangeEvent) => setFooterHeight(e.nativeEvent.layout.height),
    [setFooterHeight]
  );

  const trackScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const fromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
      travel.setValue(fabTravel(fabLift(footerHeight.current, fromBottom), insets.bottom));
      // Same value as last time is a no-op in React, so this only renders on the two crossings.
      setVisible(contentOffset.y > SHOW_AFTER_SCROLL_Y);
    },
    [travel, insets.bottom]
  );

  // Stable, so a screen wrapping `trackScroll` in its own handler does not hand the ScrollView a
  // new onScroll every render.
  return useMemo(
    () => ({ visible, travel, trackScroll, measureFooter, setFooterHeight }),
    [visible, travel, trackScroll, measureFooter, setFooterHeight]
  );
}
