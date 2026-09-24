import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.xxl,
    paddingTop: theme.spacing.xxxl,
    gap: theme.spacing.lg,
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
  },
  pageHeader: { gap: 4 },
  pageSub: { ...theme.typography.body },
  card: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  cardTitle: { ...theme.typography.bodyBold },
  addFields: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    alignItems: "flex-end",
  },
  addField: { flexGrow: 1, flexBasis: 180, minWidth: 140 },
  addSeats: { flexBasis: 140, flexGrow: 0 },
  field: { gap: theme.spacing.xs },
  label: { ...theme.typography.label },
  list: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  ticket: {
    ...theme.typography.bodyBold,
    fontSize: 18,
    minWidth: 44,
  },
  who: { flexGrow: 1, flexBasis: 200, gap: 2 },
  name: { ...theme.typography.bodyBold },
  meta: { fontSize: 13 },
  wait: { minWidth: 110, fontSize: 14, fontWeight: "600" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.xs },
  error: { fontSize: 14 },
});
