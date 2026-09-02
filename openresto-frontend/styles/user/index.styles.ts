import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  hero: {
    borderBottomWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  /** One step of the hero's card → page settle off web; the stack of them fills the hero. */
  heroFadeStep: {
    flex: 1,
  },
  /** A zero-size anchor at a bloom's centre, which its rings hang off symmetrically. */
  heroBloom: {
    position: "absolute",
    width: 0,
    height: 0,
  },
  heroBloomRing: {
    position: "absolute",
  },
  /**
   * Legibility for the strings that sit directly on the header photo off web, where the web
   * branch's two-layer CSS `textShadow` has no equivalent — React Native takes one shadow.
   */
  heroOverlayTextShadow: {
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroInner: {
    maxWidth: 1320,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 56,
    paddingBottom: 28,
    position: "relative",
  },
  heroTextPill: {
    alignSelf: "flex-start",
  },
  heroTitle: {
    fontSize: 64,
    fontWeight: "700",
    lineHeight: 68,
    letterSpacing: -1.5,
    marginBottom: 14,
    maxWidth: 820,
  },
  heroSub: {
    fontSize: 17,
    fontWeight: "500",
    lineHeight: 26,
    maxWidth: 500,
  },

  highlights: {
    maxWidth: 1320,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 40,
  },
  highlightsHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  highlightsLabel: {
    fontSize: 13,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  highlightsBy: {
    fontSize: 12,
    fontWeight: "500",
  },
  highlightsGrid: {
    gap: 12,
  },
  rowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  highlightsRailContent: {
    gap: 12,
  },
  highlightCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    width: "100%",
  },
  highlightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  highlightIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  highlightTitle: {
    fontSize: 14.5,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  highlightBody: {
    fontSize: 13,
    lineHeight: 19,
  },

  body: {
    maxWidth: 1320,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 60,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  grid: {
    gap: 18,
  },
  cardWrapper: {
    width: "100%",
  },
});
