import { useEffect, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, Pressable, View } from "react-native";
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

/** Long enough to read as a fade rather than a flicker, short enough not to trail the scroll. */
export const FADE_MS = 160;

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

/**
 * Height a page-ending row keeps clear so the FAB doesn't come to rest on it. Above the
 * content cap the FAB sits in the gutter beside the column and the row it ends on is
 * already clear of it, so nothing is reserved; below the cap there is no gutter, and the
 * FAB lands on whatever the page ends with — the footer's links — once the scroll stops.
 *
 * @see [Footer.test.tsx](../../tests/components/layout/Footer.test.tsx) — pins that the
 * footer reserves this below the cap and nothing above it.
 */
export function fabRestingBand(containerWidth: number): number {
  if (fabGutter(containerWidth) > FAB_MIN_GUTTER) return 0;
  return FAB_MIN_GUTTER + FAB_SIZE + FAB_MIN_GUTTER;
}

interface Props {
  visible: boolean;
  onPress: () => void;
}

/**
 * The return-to-top shortcut. It holds one position for the whole scroll; `useScrollToTopFab`
 * decides when it is offered.
 *
 * Nothing here tracks the scroll position. An earlier version rode above the footer, which meant
 * recomputing an offset on every scroll event and moving an element that reads as pinned (#399).
 * The footer keeps out of the FAB's way instead, by reserving `fabRestingBand` at the widths
 * where the gutter is too narrow to hold the FAB beside the column.
 *
 * @see [ScrollToTopFab.test.tsx](../../tests/components/ScrollToTopFab.test.tsx) — pins that it
 * rests on the same gutter whether shown or hidden, and takes no presses once faded.
 */
export default function ScrollToTopFab({ visible, onPress }: Props) {
  const { primaryColor } = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // The lane spans whatever box the FAB was mounted into — the page on most screens, a
  // single column on Locations once its booking drawer takes the other one — so the FAB
  // follows the column it belongs to rather than the window.
  const [laneWidth, setLaneWidth] = useState(0);

  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  // The lane stays mounted while the FAB is hidden so it keeps its measured width. Unmounting it
  // dropped that back to zero on every hide, and the FAB reappeared against the fallback gutter
  // for a frame before layout put it back against the content column — a sideways jump each time
  // it came back. Deliberately not gated on width or orientation: every screen that mounts this
  // is long enough to bury its own header on a desktop window too.
  return (
    <View
      testID="scroll-to-top-lane"
      pointerEvents="box-none"
      onLayout={(e: LayoutChangeEvent) => setLaneWidth(e.nativeEvent.layout.width)}
      style={[
        styles.lane,
        {
          bottom: insets.bottom + FAB_MIN_GUTTER,
          paddingRight: fabGutter(laneWidth),
        },
      ]}
    >
      <Animated.View style={{ opacity }} pointerEvents={visible ? "auto" : "none"}>
        <Pressable
          testID="scroll-to-top-fab"
          style={[styles.fab, { backgroundColor: primaryColor }]}
          onPress={onPress}
          disabled={!visible}
          // `aria-hidden`, not accessibilityElementsHidden/importantForAccessibility: React
          // Native maps this one onto both of those, and react-native-web forwards it to the DOM
          // — the native-only pair is dropped there, leaving a labelled button in the web a11y
          // tree for the whole scroll.
          aria-hidden={!visible}
          accessibilityLabel={t("common.actions.scrollToTop")}
          accessibilityRole="button"
        >
          <Icon name="chevron-up" size={22} color="#fff" />
        </Pressable>
      </Animated.View>
    </View>
  );
}
