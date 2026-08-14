import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  sidebar: {
    width: 230,
    borderRightWidth: 1,
    paddingVertical: 8,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTextGroup: {
    flex: 1,
    gap: 1,
  },
  brandName: {
    ...theme.typography.bodyBold,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  brandSub: {
    ...theme.typography.captionSmall,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    marginHorizontal: 12,
    marginVertical: 6,
  },
  nav: {
    paddingTop: 4,
    gap: 2,
    paddingHorizontal: 8,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    position: "relative",
    gap: 10,
  },
  navLabel: {
    fontSize: 14,
    flex: 1,
  },
  activeBar: {
    position: "absolute" as const,
    left: 0,
    top: "50%",
    marginTop: -8,
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  spacer: {
    flex: 1,
  },
  ctaWrapper: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 6,
  },
  lookupLabel: {
    ...theme.typography.labelSmall,
    fontWeight: "700",
    paddingLeft: 2,
  },
  lookupInput: {
    height: theme.formSizes.inputSmHeight,
    paddingHorizontal: theme.formSizes.inputPaddingH,
    fontSize: 13,
    borderRadius: theme.formSizes.inputBorderRadius,
    borderWidth: 1,
  },
  lookupBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: theme.formSizes.inputSmHeight,
    borderRadius: theme.formSizes.inputBorderRadius,
  },
  lookupBtnText: {
    color: theme.colors.white,
    fontSize: 13,
    fontWeight: "600",
  },
  lookupHint: {
    ...theme.typography.captionSmall,
    paddingLeft: 2,
  },
  footer: {
    paddingTop: 4,
    paddingHorizontal: 8,
    gap: 2,
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.md,
  },
  footerText: {
    fontSize: 13,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  identityName: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
