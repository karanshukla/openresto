import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  trigger: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  panelInner: {
    padding: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.md,
  },
  rowText: {
    fontSize: 14,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    marginVertical: 6,
    marginHorizontal: 4,
  },
  socialRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  socialBtn: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  helpText: {
    ...theme.typography.caption,
    lineHeight: 20,
  },
  helpLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  helpLinkText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
