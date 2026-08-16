import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  header: { alignItems: "center", gap: 8, marginTop: 8, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.6, marginTop: 8 },
  subtitle: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  // Idle: a single centred column, the width of the search card — no result column is
  // reserved before there's a result to put in it.
  singleCol: { width: "100%", maxWidth: 440, alignSelf: "center", gap: theme.spacing.md },
  // Once a lookup runs, the form column shifts left and the panel takes the rest.
  wideRow: { flexDirection: "row", gap: 24, alignItems: "flex-start" },
  wideCol: { flex: 1 },
  searchCard: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    width: "100%",
    ...theme.shadows.md,
  },
  label: { ...theme.typography.label, letterSpacing: 0.2 },
  helpText: { ...theme.typography.caption, textAlign: "center", lineHeight: 18, marginTop: 4 },
  msgCard: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    ...theme.shadows.md,
  },
  msgRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  msgText: { ...theme.typography.body, flexShrink: 1 },
});
