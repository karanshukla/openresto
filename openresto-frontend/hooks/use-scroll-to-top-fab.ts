import { useCallback, useState } from "react";
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { SHOW_AFTER_SCROLL_Y } from "@/components/common/ScrollToTopFab";

/**
 * How far the FAB has to rise to stay off a footer `footerHeight` tall, with
 * `fromBottom` px of the scroll still to go. Zero until the footer starts entering the
 * viewport, then tracks it one for one, so the FAB comes to rest on the footer's top edge
 * rather than on the links in it. The footer's own height is the ceiling: a bouncing
 * scroll reports a negative distance, which would otherwise walk the FAB up the page.
 *
 * @see [use-scroll-to-top-fab.test.ts](../tests/hooks/use-scroll-to-top-fab.test.ts) —
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
 */
export function useScrollToTopFab() {
  const [visible, setVisible] = useState(false);
  const [lift, setLift] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);

  const trackScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      setVisible(contentOffset.y > SHOW_AFTER_SCROLL_Y);
      const fromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
      setLift(fabLift(footerHeight, fromBottom));
    },
    [footerHeight]
  );

  const measureFooter = useCallback((e: LayoutChangeEvent) => {
    setFooterHeight(e.nativeEvent.layout.height);
  }, []);

  return { visible, lift, trackScroll, measureFooter, setFooterHeight };
}
