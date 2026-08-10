import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

/** Width of the docked side panel; the sheet layout uses the full width instead. */
export const DRAWER_WIDTH = 460;

export const styles = StyleSheet.create({
  side: {
    width: DRAWER_WIDTH,
    flexShrink: 0,
    borderLeftWidth: 1,
  },
  sheetRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    fontSize: 19,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  summary: {
    fontSize: 13,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    padding: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  errorBanner: {
    backgroundColor: "rgba(220,38,38,0.08)",
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.error,
    fontSize: 14,
  },
});
