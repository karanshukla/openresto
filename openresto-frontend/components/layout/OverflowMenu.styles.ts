import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  trigger: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  helpBackdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay.light,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xxl,
  },
  panel: {
    position: "absolute",
    minWidth: 230,
    borderRadius: theme.borderRadius.modal,
    borderWidth: 1,
    padding: 6,
    ...theme.shadows.popup,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.md,
  },
  rowText: {
    fontSize: 14,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    marginVertical: 6,
    marginHorizontal: 4,
  },
  socialRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  socialBtn: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  helpCard: {
    borderRadius: theme.borderRadius.modal,
    borderWidth: 1,
    padding: theme.spacing.xxl,
    width: "100%",
    maxWidth: 380,
    gap: theme.spacing.md,
    ...theme.shadows.popup,
  },
  helpText: {
    ...theme.typography.caption,
    lineHeight: 20,
  },
  helpLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  helpLinkText: {
    fontSize: 14,
    fontWeight: "500",
  },
  closeBtn: {
    paddingVertical: 11,
    borderRadius: theme.borderRadius.lg,
    alignItems: "center",
    marginTop: theme.spacing.sm,
    borderWidth: 1,
  },
  closeBtnText: {
    ...theme.typography.bodyBold,
  },
});
