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
    gap: 14,
    paddingHorizontal: 8,
  },
  navSection: {
    gap: 2,
  },
  navHeading: {
    ...theme.typography.labelSmall,
    fontWeight: "700",
    letterSpacing: 0.8,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    position: "relative",
    gap: 10,
  },
  navIcon: {
    position: "relative",
    width: 20,
  },
  navBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  navBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: theme.colors.white,
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
  languageSwitcher: {
    paddingHorizontal: 4,
    paddingVertical: 4,
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
