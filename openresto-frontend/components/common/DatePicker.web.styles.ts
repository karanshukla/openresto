import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 0,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    height: theme.formSizes.inputHeight,
    borderWidth: 1,
    borderRadius: theme.formSizes.inputBorderRadius,
    paddingHorizontal: theme.formSizes.inputPaddingH,
  },
  triggerText: { fontSize: theme.formSizes.inputFontSize },
  triggerLead: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minWidth: 0,
  },
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay.light,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  calendar: {
    width: 280,
    borderWidth: 1,
    borderRadius: theme.borderRadius.card,
    padding: 12,
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  navButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  weekdayRow: {
    flexDirection: "row",
  },
  weekRow: {
    flexDirection: "row",
  },
  cell: {
    width: 36,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCell: {
    margin: 1,
  },
});
