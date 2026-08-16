import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  content: { flexDirection: "row", gap: theme.spacing.xs, alignItems: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  label: { fontSize: 13, fontWeight: "600" },
  archivedLabel: { opacity: 0.75 },
});
