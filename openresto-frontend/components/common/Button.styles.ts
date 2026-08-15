import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  button: {
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  // Opt-in stretch, for a button that is the only control in a form column and inside a
  // ButtonRow, whose `alignItems: center` otherwise sizes children to their content.
  fullWidth: { alignSelf: "stretch", width: "100%" },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  hovered: {
    opacity: 0.85,
  },
  buttonText: {
    ...theme.typography.bodyBold,
    textAlign: "center",
  },
  // The dense end of the scale keeps the row-level 13px label so a list row's action cluster
  // does not outgrow the row it sits in.
  buttonTextSm: {
    ...theme.typography.label,
  },
});
