import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "@/theme/theme";
import type { AnchoredPanel } from "@/utils/anchoredPanel";

export const styles = StyleSheet.create({
  // A panel hanging off its trigger doesn't dim the page behind it; a centred sheet does. The
  // backdrop covers the screen either way, so a press outside closes.
  backdropAnchored: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay.light,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  // Web: hung off the trigger. Position and size come from utils/anchoredPanel at open time.
  panel: {
    position: "absolute",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    ...theme.shadows.popup,
  },
  // Native, and any web trigger that couldn't be measured: a centred sheet.
  sheet: {
    borderRadius: 14,
    borderWidth: 1,
    maxHeight: 360,
    width: "100%",
    maxWidth: 360,
    overflow: "hidden",
  },
});

/**
 * The two shapes an anchored popup takes: hung off its trigger when it could be measured, a
 * centred sheet when it could not.
 *
 * Pure functions rather than ternaries inside the component, because the anchored side is
 * unreachable from a component test — under react-test-renderer a ref never reports a box, so a
 * branch written inline there could only ever be exercised one way.
 *
 * @see [AnchoredPanel.test.tsx](../../tests/components/common/AnchoredPanel.test.tsx) — pins
 * both shapes.
 */
export const backdropStyleFor = (anchored: boolean): StyleProp<ViewStyle> =>
  anchored ? styles.backdropAnchored : styles.backdrop;

export const panelStyleFor = (
  panel: AnchoredPanel | null,
  borderColor: string
): StyleProp<ViewStyle> =>
  panel
    ? [
        styles.panel,
        {
          borderColor,
          // Spread rather than set both: the panel is pinned by its top edge or its bottom one,
          // and passing an undefined counterpart would fight the one that matters.
          ...(panel.top === undefined ? { bottom: panel.bottom } : { top: panel.top }),
          left: panel.left,
          width: panel.width,
          maxHeight: panel.maxHeight,
        },
      ]
    : [styles.sheet, { borderColor }];
