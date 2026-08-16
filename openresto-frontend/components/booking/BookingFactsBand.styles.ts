import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  band: { flexDirection: "row" },
  // Equal cells, so the three facts share the width rather than each taking a full row.
  // minWidth: 0 lets a long localised date wrap inside its cell instead of forcing the
  // band wider than the card.
  cell: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    gap: 3,
  },
  cellDivided: { borderLeftWidth: 1 },
  key: { ...theme.typography.labelSmall, textTransform: "uppercase", letterSpacing: 0.6 },
  value: { fontSize: 17, fontWeight: "700", lineHeight: 22 },
  valueNegated: { textDecorationLine: "line-through" },
  sub: { ...theme.typography.caption },
});
