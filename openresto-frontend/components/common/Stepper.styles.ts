import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  // Sized like a Select trigger so the field it replaces off web keeps the same footprint
  // in a form column of inputs.
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: theme.formSizes.inputBorderRadius,
    height: theme.formSizes.inputHeight,
    paddingHorizontal: theme.spacing.xs,
  },
  value: {
    flex: 1,
    textAlign: "center",
    fontSize: theme.formSizes.inputFontSize,
    fontWeight: "600",
  },
});
