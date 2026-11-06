import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  list: { gap: theme.spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 1,
  },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowDate: { fontSize: 14, fontWeight: "600" },
  rowDetail: { fontSize: 12, lineHeight: 16 },
  modeGroupStandalone: { alignSelf: "flex-start" },
  fieldGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.md },
  gridField: { flexGrow: 1, flexBasis: 160, minWidth: 140, gap: theme.spacing.xxs },
  dateField: { gap: theme.spacing.xxs, maxWidth: 320 },
  typeDescription: { fontSize: 12, lineHeight: 16 },
});
