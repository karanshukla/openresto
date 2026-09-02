import { StyleSheet } from "react-native";
import { CONTENT_MAX_WIDTH, CONTENT_PADDING_H } from "@/constants/breakpoints";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  footer: {
    width: "100%",
    borderTopWidth: 1,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    rowGap: theme.spacing.sm,
    columnGap: theme.spacing.md,
    maxWidth: CONTENT_MAX_WIDTH,
    width: "100%",
    minHeight: 56,
    alignSelf: "center",
    paddingHorizontal: CONTENT_PADDING_H,
    paddingVertical: theme.spacing.lg,
  },
  innerMobile: {
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  // `column-reverse`, not `column`: it draws the fine print under the links the way an app's
  // last screen row reads, while leaving the children in the order a screen reader walks them
  // in — the same order the web row is read left to right.
  innerStacked: {
    flexDirection: "column-reverse",
    alignItems: "center",
    justifyContent: "center",
    rowGap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  copyright: {
    fontSize: 13,
    lineHeight: 18,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.lg,
  },
  rightWrapped: {
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: theme.spacing.lg,
    rowGap: theme.spacing.sm,
  },
  social: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 4,
    borderRadius: theme.borderRadius.md,
  },
  socialLabel: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  adminBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 32,
    paddingHorizontal: theme.spacing.xs,
  },
  adminText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
});
