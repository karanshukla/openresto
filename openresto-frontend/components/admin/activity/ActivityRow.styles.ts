import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

/**
 * The label column of the expanded detail. Every row — When, Request, From, Device and each
 * changed field — shares it, so the values line up as one column instead of as four stacks.
 * Wide enough for a field name like `smtpPassword` at the detail's type size.
 */
const DETAIL_LABEL_WIDTH = 88;

export const styles = StyleSheet.create({
  wrap: { overflow: "hidden" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 13,
    gap: 10,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  body: { flex: 1, gap: 2, minWidth: 0 },
  primary: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  secondary: { fontSize: 12, lineHeight: 17 },
  meta: { fontSize: 12, lineHeight: 17 },

  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1,
  },
  statusText: { fontSize: 11, fontWeight: "700" },

  detail: {
    borderTopWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  changesBlock: {
    gap: theme.spacing.xxs,
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
  },
  changesHeading: { ...theme.typography.label, fontSize: 12 },
  metaBlock: { gap: theme.spacing.xxs },

  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.xsm,
  },
  detailLabel: {
    ...theme.typography.caption,
    fontWeight: "600",
    width: DETAIL_LABEL_WIDTH,
    flexShrink: 0,
  },
  detailValue: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: theme.spacing.xxs,
  },
  detailValueText: {
    ...theme.typography.caption,
    lineHeight: 18,
    flexShrink: 1,
  },

  changeValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    flexShrink: 1,
    minWidth: 0,
  },
  redacted: { fontStyle: "italic" },
});
