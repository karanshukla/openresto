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
  // Flexible so a label longer than the trigger (a long timezone, a wordy ref format)
  // truncates inside the control instead of pushing the chevron past its border.
  triggerText: { flex: 1, minWidth: 0, fontSize: theme.formSizes.inputFontSize },
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
  // The border is always there and usually invisible: the keyboard's highlight colours it in,
  // and a ring that appeared only when focused would nudge every other day in the row.
  dayCell: {
    margin: 1,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: theme.borderRadius.sm,
  },
});
