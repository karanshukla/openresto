import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

const PARTY_BADGE_SIZE = 48;

export const styles = StyleSheet.create({
  card: {
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: "transparent",
  },
  top: { flexDirection: "row", gap: theme.spacing.md },
  party: {
    width: PARTY_BADGE_SIZE,
    height: PARTY_BADGE_SIZE,
    borderRadius: theme.borderRadius.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  partySize: { fontSize: 20, fontWeight: "800", lineHeight: 22 },
  main: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  name: { ...theme.typography.bodyBold, flexShrink: 1 },
  ticket: { ...theme.typography.label, marginLeft: "auto" },
  meta: { fontSize: 13, lineHeight: 18 },
  wait: { fontSize: 13, fontWeight: "700", lineHeight: 18 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  seat: { marginLeft: "auto" },
});
