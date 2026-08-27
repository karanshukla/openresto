import { useMemo, useState } from "react";
import { Animated, LayoutChangeEvent, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useAppTheme } from "@/hooks/use-app-theme";
import { CONTENT_MAX_WIDTH, CONTENT_PADDING_H } from "@/constants/breakpoints";
import { FAB_SIZE, styles } from "./ScrollToTopFab.styles";
import { Icon } from "@/components/common/Icon";

/** Scroll distance past which the return-to-top shortcut is worth offering. */
export const SHOW_AFTER_SCROLL_Y = 300;

/** Inset used once the container is no wider than the content column and has no gutter to sit in. */
export const FAB_MIN_GUTTER = 20;

/**
 * How far the FAB travels up from where it rests, given the lift it has been handed and the
 * safe-area inset it is already sitting on. The footer carries that inset itself, so the two
 * never stack — the FAB only moves once the lift exceeds ground it already covers.
 *
 * The travel is applied as a transform rather than by moving the FAB's `bottom`, because it
 * changes on every scroll event once the footer is entering view: `bottom` puts the browser
 * through layout for each of those, a frame behind the scroll that caused it, which is what made
 * the FAB judder up and down the page on web. A transform is composited and moves with it.
 *
 * @see [ScrollToTopFab.test.tsx](../../tests/components/ScrollToTopFab.test.tsx) — pins that the
 * FAB stays put while the lift is inside the inset it already clears, and rises by the excess.
 */
export function fabTravel(lift: number, bottomInset: number): number {
  return Math.max(0, lift - bottomInset);
}

/**
 * Right inset for the FAB inside a container of `containerWidth`. Above the content
 * column's cap the container has a gutter either side of it, and the FAB goes in the
 * right-hand one with its left edge against the column — beside the page rather than out
 * at the viewport corner, and clear of the footer's own row, which ends on that same edge.
 *
 * @see [ScrollToTopFab.test.tsx](../../tests/components/ScrollToTopFab.test.tsx) — pins
 * that it tucks against the column above the cap and holds the plain inset below it.
 */
export function fabGutter(containerWidth: number): number {
  const columnEdge = (containerWidth - CONTENT_MAX_WIDTH) / 2 + CONTENT_PADDING_H;
  return Math.max(FAB_MIN_GUTTER, columnEdge - FAB_SIZE);
}

interface Props {
  visible: boolean;
  onPress: () => void;
  /**
   * How far to rise off the resting gutter, so the FAB clears a footer scrolling into view
   * underneath it. An `Animated.Value` rather than a number because it changes on every scroll
   * event: see `useScrollToTopFab` for why that must not go through React.
   */
  travel?: Animated.Value;
}

export default function ScrollToTopFab({ visible, onPress, travel }: Props) {
  const { primaryColor } = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // The lane spans whatever box the FAB was mounted into — the page on most screens, a
  // single column on Locations once its booking drawer takes the other one — so the FAB
  // follows the column it belongs to rather than the window.
  const [laneWidth, setLaneWidth] = useState(0);

  // Negated because a positive travel means "further up the page", and translateY grows downward.
  const rise = useMemo(
    () => (travel ? Animated.multiply(travel, -1) : new Animated.Value(0)),
    [travel]
  );

  // The lane stays mounted while the FAB is hidden so it keeps its measured width. Unmounting it
  // dropped that back to zero on every hide, and the FAB reappeared against the fallback gutter
  // for a frame before layout put it back against the content column — a sideways jump each time
  // it came back. Deliberately not gated on width or orientation: every screen that mounts this
  // is long enough to bury its own header on a desktop window too.
  return (
    <Animated.View
      testID="scroll-to-top-lane"
      pointerEvents="box-none"
      onLayout={(e: LayoutChangeEvent) => setLaneWidth(e.nativeEvent.layout.width)}
      style={[
        styles.lane,
        {
          bottom: insets.bottom + FAB_MIN_GUTTER,
          paddingRight: fabGutter(laneWidth),
          transform: [{ translateY: rise }],
        },
      ]}
    >
      {visible && (
        <Pressable
          style={[styles.fab, { backgroundColor: primaryColor }]}
          onPress={onPress}
          accessibilityLabel={t("common.actions.scrollToTop")}
          accessibilityRole="button"
        >
          <Icon name="chevron-up" size={22} color="#fff" />
        </Pressable>
      )}
    </Animated.View>
  );
}
