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
  copyright: {
    fontSize: 13,
    lineHeight: 18,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.lg,
  },
  languageSwitcher: {
    width: 150,
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
