import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const BAR_MAX_HEIGHT = 64;

export const styles = StyleSheet.create({
  card: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    padding: theme.spacing.xl,
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.xxl,
  },
  title: { ...theme.typography.h3 },
  location: { gap: theme.spacing.sm },
  locationHeader: { flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.md },
  locationName: { fontWeight: "600" },
  meta: { fontSize: 12 },
  bars: { flexDirection: "row", alignItems: "flex-end", flexWrap: "wrap", gap: theme.spacing.sm },
  slot: { flex: 1, alignItems: "center", gap: theme.spacing.xxs, minWidth: 36 },
  track: {
    height: BAR_MAX_HEIGHT,
    width: "100%",
    maxWidth: 32,
    justifyContent: "flex-end",
    borderRadius: 4,
  },
  bar: { width: "100%", borderRadius: 4 },
  slotText: { fontSize: 11 },
});
