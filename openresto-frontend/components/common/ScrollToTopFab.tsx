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

interface Props {
  visible: boolean;
  onPress: () => void;
}

/**
 * The return-to-top shortcut. It holds one position for the whole scroll and fades out where the
 * footer would otherwise be underneath it; `useScrollToTopFab` decides when.
 *
 * Nothing here tracks the scroll position. An earlier version rode above the footer, which meant
 * recomputing an offset on every scroll event and moving an element that reads as pinned (#399).
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
          accessibilityElementsHidden={!visible}
          importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
          accessibilityLabel={t("common.actions.scrollToTop")}
          accessibilityRole="button"
        >
          <Icon name="chevron-up" size={22} color="#fff" />
        </Pressable>
      </Animated.View>
    </View>
  );
}
