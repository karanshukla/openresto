import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderTopWidth: 1,
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
  sub: { ...theme.typography.caption, marginTop: 1 },
  error: { fontSize: 12, marginTop: theme.spacing.xs },
});
