import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { theme } from "@/theme/theme";
import type { AnchoredPanel } from "@/utils/selectAnchor";

export const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderRadius: theme.formSizes.inputBorderRadius,
    paddingHorizontal: theme.formSizes.inputPaddingH,
    height: theme.formSizes.inputHeight,
  },
  triggerLead: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minWidth: 0,
  },
  // Flexible so a label longer than the trigger (a long timezone, a wordy ref format)
  // truncates inside the control instead of pushing the chevron past its border.
  triggerText: { flex: 1, minWidth: 0, fontSize: theme.formSizes.inputFontSize },
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay.light,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  // Native, and any web trigger that couldn't be measured: a centred sheet.
  modalView: {
    borderRadius: 14,
    borderWidth: 1,
    maxHeight: 360,
    width: "100%",
    maxWidth: 360,
    overflow: "hidden",
  },
  // Web: hung off the trigger. Position and size come from utils/selectAnchor at open time.
  backdropAnchored: {
    flex: 1,
  },
  panel: {
    position: "absolute",
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    ...theme.shadows.popup,
  },
  list: {
    width: "100%",
  },
  separator: {
    height: 1,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  optionText: {
    fontSize: 15,
  },
  checkmark: {
    fontWeight: "600",
  },
});

/**
 * The two shapes the options list takes: hung off its trigger when it could be measured, a
 * centred sheet when it could not.
 *
 * Pure functions rather than ternaries inside the component, because the anchored side is
 * unreachable from a component test — under react-test-renderer a ref never reports a box, so a
 * branch written inline there could only ever be exercised one way.
 *
 * @see [Select.test.tsx](../../tests/components/Select.test.tsx) — pins both shapes.
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
    : [styles.modalView, { borderColor }];
