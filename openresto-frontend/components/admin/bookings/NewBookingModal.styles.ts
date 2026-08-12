import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay.light,
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xxl,
  },
  sheet: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "85%",
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    overflow: "hidden",
    ...theme.shadows.popup,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  closeBtn: {
    padding: theme.spacing.xs,
  },
  loadingContainer: {
    padding: theme.spacing.xxxl,
    alignItems: "center",
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  errorBanner: {
    backgroundColor: "rgba(220,38,38,0.1)",
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  errorText: { ...theme.typography.label, color: "#dc2626" },
  field: { gap: theme.spacing.xs },
  label: { ...theme.typography.label },
  fieldRow: { flexDirection: "row", gap: theme.spacing.md },
  fieldHalf: { flex: 1 },
});
