import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";
import { CONTENT_MAX_WIDTH, CONTENT_PADDING_H } from "@/constants/breakpoints";

/** Nav bar height excluding the safe-area inset the component adds on top. */
export const NAV_HEIGHT = 64;

export const styles = StyleSheet.create({
  nav: {
    width: "100%",
    borderBottomWidth: 1,
    height: NAV_HEIGHT,
    justifyContent: "center",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    maxWidth: CONTENT_MAX_WIDTH,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: CONTENT_PADDING_H,
    height: "100%",
    overflow: "hidden",
  },
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    marginRight: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -18,
    marginRight: 4,
  },
  brand: {
    paddingVertical: 4,
    flexShrink: 1,
  },
  brandText: {
    ...theme.typography.h2,
    fontSize: 20,
    letterSpacing: -0.5,
  },
  links: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    height: "100%",
    flexShrink: 0,
  },
  linkBtn: {
    ...theme.buttonSizes.md,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  linkText: {
    fontSize: 15,
    fontWeight: "500",
  },
  linkUnderline: {
    position: "absolute",
    bottom: 0,
    left: 14,
    right: 14,
    height: 2,
    borderRadius: 2,
  },
});
