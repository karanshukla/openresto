import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  list: { gap: theme.spacing.sm },
  // Unlike the other list tiles this one top-aligns: the body text wraps to several lines and
  // the icon square should sit level with the title, not float in the middle of the block.
  tileTop: { alignItems: "flex-start" },
  body: { fontSize: 12, marginTop: 2 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 3 },
  linkText: { fontSize: 11 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  bodyInput: { height: 76, paddingTop: theme.spacing.xsm, paddingBottom: theme.spacing.xsm },
  linkHint: { fontSize: 11 },
});
