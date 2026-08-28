import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  warning: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    marginTop: theme.spacing.md,
  },
  warningIcon: { marginTop: 1 },
  warningText: { flex: 1, fontSize: 12, lineHeight: 17 },
  secretRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    marginTop: theme.spacing.md,
  },
  // The secret is one unbroken ~50-character token, so its min-content width is the whole
  // string. A flex item defaults to min-width:auto and so refuses to shrink below that,
  // which pushed the Copy button clean outside the modal. minWidth:0 lets it shrink, and
  // react-native-web's Text already carries word-wrap:break-word to wrap what's left.
  secretText: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: "600" },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
  },
});
