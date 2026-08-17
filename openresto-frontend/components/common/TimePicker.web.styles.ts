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
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay.light,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  panel: {
    width: 240,
    maxHeight: 360,
    borderWidth: 1,
    borderRadius: theme.borderRadius.card,
    overflow: "hidden",
    paddingVertical: 8,
  },
  panelTitle: {
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  list: {
    width: "100%",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  checkmark: {
    fontWeight: "600",
  },
});
