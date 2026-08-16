import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  section: { marginTop: theme.spacing.xl, gap: theme.spacing.xsm, width: "100%" },
  title: {
    ...theme.typography.labelSmall,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  card: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    padding: 14,
    ...theme.shadows.md,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md },
  ref: { fontSize: 14, fontWeight: "700", letterSpacing: -0.2, flex: 1 },
  meta: { ...theme.typography.caption },
});
