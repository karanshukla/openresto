import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
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
  titleRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  title: { ...theme.typography.bodyBold },
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: "600" },
  sub: { ...theme.typography.caption, marginTop: 2 },
  error: { fontSize: 12, marginTop: theme.spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderTopWidth: 1,
  },
  rowTitle: { ...theme.typography.bodyBold },
  rowSub: { ...theme.typography.caption, marginTop: 1 },
});
