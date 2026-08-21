import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
  },
  // The all-clear is reassurance, not an alert: a quiet row rather than the bordered card the
  // conflict list uses, so it reads as the absence of a problem instead of a fifth section.
  clearRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.xs,
  },
  clearText: { ...theme.typography.caption },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  title: { ...theme.typography.bodyBold },
  sub: { ...theme.typography.caption, marginTop: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
  },
  rowCopy: { flex: 1 },
  rowTitle: { ...theme.typography.bodyBold },
  rowSub: { ...theme.typography.caption, marginTop: 1 },
});
