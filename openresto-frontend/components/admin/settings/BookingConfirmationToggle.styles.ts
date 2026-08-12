import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  wrapper: { gap: theme.spacing.sm },
  card: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    overflow: "hidden",
  },
  cardDisabled: { opacity: 0.65 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: theme.spacing.md,
    paddingHorizontal: 14,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  title: { fontSize: 14, fontWeight: "500" },
  badge: {
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  subtitle: { fontSize: 12.5, marginTop: 2 },
  hint: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xxs,
    padding: theme.spacing.xsm,
    paddingHorizontal: 14,
    borderTopWidth: 1,
  },
  hintText: { fontSize: 12 },
});
