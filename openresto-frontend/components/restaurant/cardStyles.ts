import { StyleSheet } from "react-native";

/**
 * Presentation shared by the two restaurant cards — the home page's `RestaurantCard`
 * and the Locations list's `LocationListItem`.
 *
 * Status badges are solid and always carry white text, because on the home card they sit
 * on top of a dark photo. Keeping that treatment on the Locations card means one badge
 * rather than two that mean the same thing and look different.
 */
export const cardStyles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  /** Also used for "opens later" and walk-in badges. */
  badgeMuted: {
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  badgeText: {
    color: "#fff",
    fontSize: 11.5,
    fontWeight: "500",
  },

  /** The card's secondary action: plain text, ink only, surface only while pressed. */
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
  },
  viewBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
});

/** The solid accent fill an "Open till …" badge uses, from the brand's primary colour. */
export function openBadgeColor(r: number, g: number, b: number): string {
  return `rgba(${r},${g},${b},0.88)`;
}
