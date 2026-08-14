import { StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

/**
 * The preview is a miniature of the customer home page, so its type scale is its own: roughly
 * half the real page's sizes, which keeps the proportions readable in a ~400px column instead
 * of shrinking the whole thing with a transform (which would blur the text).
 */
export const styles = StyleSheet.create({
  panel: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    overflow: "hidden",
    ...theme.shadows.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  headerCopy: { flex: 1 },
  headerTitle: { ...theme.typography.bodyBold },
  headerSub: { ...theme.typography.caption, marginTop: 1 },
  schemeGroup: {
    flexDirection: "row",
    gap: 2,
    padding: 3,
    borderRadius: 9,
  },
  schemeBtn: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: 7,
  },
  schemeLabel: { fontSize: 11, fontWeight: "600" },

  body: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
    gap: theme.spacing.sm,
    borderTopWidth: 1,
  },
  hint: { fontSize: 11, lineHeight: 15 },

  // Browser chrome: the frame is what makes the miniature read as "a web page" rather than
  // as another admin card, and it is where the favicon and app name are actually checked.
  frame: {
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    overflow: "hidden",
  },
  chrome: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 7,
    borderBottomWidth: 1,
  },
  chromeDots: { flexDirection: "row", gap: 4, marginRight: 2 },
  chromeDot: { width: 7, height: 7, borderRadius: 4 },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: 140,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  tabTitle: { fontSize: 10, fontWeight: "600", flexShrink: 1 },
  tabGlyph: { width: 12, height: 12, borderRadius: 3 },
  urlBar: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  urlText: { fontSize: 9 },

  hero: { position: "relative", overflow: "hidden", borderBottomWidth: 1 },
  heroInner: { padding: 14, gap: 10 },
  heroPill: { alignSelf: "flex-start" },
  heroTitle: { fontSize: 24, fontWeight: "700", lineHeight: 27, letterSpacing: -0.6 },
  heroSub: { fontSize: 10, lineHeight: 14, fontWeight: "500", marginTop: 5, maxWidth: 240 },

  highlights: { paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
  highlightsHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
  },
  highlightsLabel: {
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    fontWeight: "700",
    flexShrink: 1,
  },
  highlightsBy: { fontSize: 8, fontWeight: "500", flexShrink: 1 },
  highlightsRow: { flexDirection: "row", gap: 6 },
  highlightCard: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    gap: 5,
  },
  highlightIconBox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  highlightTitle: { fontSize: 9, fontWeight: "700", lineHeight: 12 },
  highlightBody: { fontSize: 8, lineHeight: 11 },

  locations: { padding: 14, gap: 8 },
  locationsTitle: { fontSize: 13, fontWeight: "700", letterSpacing: -0.2 },
  locationsRow: { flexDirection: "row", gap: 6 },
  locationCard: { flex: 1, borderRadius: 8, borderWidth: 1, overflow: "hidden" },
  locationImage: { height: 30 },
  locationBody: { padding: 7, gap: 5 },
  locationName: { fontSize: 9, fontWeight: "700" },
  // Two grey bars stand in for the address and opening hours: real copy at this size would
  // be unreadable noise, and the point of the row is the brand-coloured button under it.
  skeletonBar: { height: 4, borderRadius: 2 },
  locationCta: {
    marginTop: 2,
    borderRadius: 5,
    paddingVertical: 4,
    alignItems: "center",
  },
  locationCtaText: { fontSize: 8, fontWeight: "700", color: "#fff" },

  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    flexWrap: "wrap",
  },
  footerCopy: { fontSize: 8, flex: 1, minWidth: 120 },
  footerSocial: { flexDirection: "row", alignItems: "center", gap: 8 },
  footerSocialItem: { flexDirection: "row", alignItems: "center", gap: 3 },
  footerSocialLabel: { fontSize: 8, fontWeight: "500" },
});

/** Absolute fill for the hero's background image and its tint, which are DOM-only. */
export const domStyles = {
  heroImage: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none" as const,
  },
  tabFavicon: { width: 12, height: 12, display: "block" as const },
};
