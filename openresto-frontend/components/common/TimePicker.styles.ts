import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
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
  modalView: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    maxHeight: 400,
    width: "100%",
    maxWidth: 320,
    overflow: "hidden",
    paddingVertical: 8,
  },
  modalTitle: {
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  list: {
    width: "100%",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  checkmark: {
    fontWeight: "600",
  },
});
