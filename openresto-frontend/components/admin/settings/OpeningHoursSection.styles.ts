import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  modeGroupStandalone: { alignSelf: "flex-start" },
  uniformTimes: { flexDirection: "row", gap: 14 },
  uniformTimeField: { flex: 1, gap: theme.spacing.xxs },
  perDayList: { gap: theme.spacing.sm },
  perDayRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xsm },
  perDayRowClosed: { opacity: 0.75 },
  dayChip: {
    width: 58,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 9,
    alignItems: "center",
  },
  dayChipLabel: { fontSize: 12, fontWeight: "600" },
  timeField: { flex: 1, minWidth: 96 },
  timeSeparator: { fontSize: 12 },
  copyBtn: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  closedLabel: { flex: 1, fontSize: 12.5, fontStyle: "italic" },
});
