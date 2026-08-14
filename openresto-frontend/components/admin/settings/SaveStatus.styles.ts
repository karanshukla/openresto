import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  // minHeight holds the corner open while idle: the row is empty between edits, and a card that
  // grew by a line every time it saved would shove the rest of the page down mid-typing.
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: theme.spacing.xxs,
    minHeight: 24,
    marginTop: theme.spacing.xs,
  },
  text: { ...theme.typography.label },
  // A validation message from the server can be a full sentence; let it wrap rather than push
  // the Retry button off the card.
  errorText: { flexShrink: 1, textAlign: "right" },
});
