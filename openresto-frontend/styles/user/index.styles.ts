import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  // Hero
  hero: {
    borderBottomWidth: 1,
    overflow: "hidden",
    position: "relative",
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

  // Highlights
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

  // Body
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
  spinner: {
    marginTop: 60,
  },
  // Footer
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 28,
    paddingVertical: 28,
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    maxWidth: 1320,
    width: "100%",
    alignSelf: "center",
  },
  footerText: {
    fontSize: 13,
  },
  footerLinks: {
    flexDirection: "row",
    gap: 18,
  },
  footerLink: {
    fontSize: 13,
  },
});
