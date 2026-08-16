import { Platform, StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

const ownsTheGesture = Platform.OS === "web" ? ({ touchAction: "none" } as object) : null;

/** Width of the side panel; the sheet variant uses the full width instead. */
export const RESULT_PANEL_WIDTH = 360;

export const styles = StyleSheet.create({
  side: {
    width: RESULT_PANEL_WIDTH,
    flexShrink: 0,
    gap: theme.spacing.sm,
  },
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    ...ownsTheGesture,
  },
  sheet: {
    maxHeight: "88%",
    borderTopWidth: 1,
    borderTopLeftRadius: theme.borderRadius.modal,
    borderTopRightRadius: theme.borderRadius.modal,
    overflow: "hidden",
  },
  grabberArea: {
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    alignItems: "center",
    ...ownsTheGesture,
  },
  grabber: { width: 40, height: 4, borderRadius: 2 },
  sheetBody: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
});
