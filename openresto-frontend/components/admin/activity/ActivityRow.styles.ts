import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  wrap: { overflow: "hidden" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 13,
    gap: 10,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  body: { flex: 1, gap: 2 },
  primary: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  secondary: { fontSize: 12, lineHeight: 17 },
  meta: { fontSize: 12, lineHeight: 17 },

  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: "700" },

  // ── Expanded detail
  detail: {
    borderTopWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  detailHeading: {
    ...theme.typography.labelSmall,
    textTransform: "uppercase",
  },
  changeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  changeField: { fontSize: 12, fontWeight: "700" },
  changeValue: { fontSize: 12 },
  changeArrow: { fontSize: 12 },
  redacted: { fontStyle: "italic" },
  monoLine: { fontSize: 12, lineHeight: 18 },
  detailBlock: { gap: 3 },
});
