import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    flexDirection: "column",
    flex: 1,
  },

  imageArea: {
    aspectRatio: 16 / 9,
    position: "relative",
    overflow: "hidden",
  },

  phRingTopRight: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 36,
    borderColor: "rgba(255,255,255,0.07)",
    top: -80,
    right: -60,
  },
  phRingBottomLeft: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 28,
    borderColor: "rgba(255,255,255,0.05)",
    bottom: -70,
    left: -50,
  },
  phCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  phInitial: {
    fontSize: 44,
    fontWeight: "700",
    color: "rgba(255,255,255,0.28)",
    letterSpacing: -1.5,
  },

  imageTopRow: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 1,
  },
  body: {
    padding: 16,
    gap: 12,
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 12.5,
    flexShrink: 1,
  },
  mapLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  mapLinksLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "600",
    marginRight: 2,
  },
  mapLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  mapLinkText: {
    fontSize: 12,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  tags: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "500",
  },

  slotLabel: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  slotLabelText: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontWeight: "600",
  },
  slotLabelWhen: {
    fontSize: 12,
    fontWeight: "500",
  },
  slotRow: {
    flexDirection: "row",
    gap: 5,
  },
  slot: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  slotText: {
    fontSize: 12.5,
    fontWeight: "500",
    textAlign: "center",
  },
  noSlotsText: {
    fontSize: 12.5,
    fontStyle: "italic",
  },
  // Fixed-min-height wrapper so cards with slots and walk-in-only cards
  // (which show an empty state instead) occupy the same vertical space.
  slotsArea: {
    minHeight: 64,
  },
  walkInEmptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
  },
  walkInEmptyText: {
    fontSize: 12.5,
    fontStyle: "italic",
  },

  cardFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    borderTopWidth: 1,
    borderStyle: "dashed",
    marginTop: "auto" as unknown as number,
  },
  hoursRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  hoursText: {
    fontSize: 13,
  },
  hoursTime: {
    fontSize: 13,
    fontWeight: "500",
  },
});
