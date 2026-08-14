import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  panel: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1 },
  headerTitle: { ...theme.typography.bodyBold },
  headerSub: { ...theme.typography.caption, marginTop: 1 },
  body: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    gap: 14,
  },
});
