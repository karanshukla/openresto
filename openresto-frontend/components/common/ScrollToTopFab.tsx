import { useState } from "react";
import { LayoutChangeEvent, Pressable, View } from "react-native";
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
   * How far to rise off the bottom of the container, on top of the resting gutter, so the
   * FAB clears a footer scrolling into view underneath it. See `useScrollToTopFab`.
   */
  lift?: number;
}

export default function ScrollToTopFab({ visible, onPress, lift = 0 }: Props) {
  const { primaryColor } = useAppTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // The lane spans whatever box the FAB was mounted into — the page on most screens, a
  // single column on Locations once its booking drawer takes the other one — so the FAB
  // follows the column it belongs to rather than the window.
  const [laneWidth, setLaneWidth] = useState(0);

  // Deliberately not gated on width or orientation. Every screen that mounts this
  // is long enough to bury its own header on a desktop window too.
  if (!visible) return null;

  return (
    <View
      testID="scroll-to-top-lane"
      pointerEvents="box-none"
      onLayout={(e: LayoutChangeEvent) => setLaneWidth(e.nativeEvent.layout.width)}
      style={[
        styles.lane,
        {
          // The footer carries the safe-area inset itself, so once it is tall enough to
          // govern the two never stack.
          bottom: Math.max(insets.bottom, lift) + FAB_MIN_GUTTER,
          paddingRight: fabGutter(laneWidth),
        },
      ]}
    >
      <Pressable
        style={[styles.fab, { backgroundColor: primaryColor }]}
        onPress={onPress}
        accessibilityLabel={t("common.actions.scrollToTop")}
        accessibilityRole="button"
      >
        <Icon name="chevron-up" size={22} color="#fff" />
      </Pressable>
    </View>
  );
}
