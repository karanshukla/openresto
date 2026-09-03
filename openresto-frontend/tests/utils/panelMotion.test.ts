import { SHEET_CLAIM_DISTANCE, shouldClaimSheetDrag } from "@/utils/panelMotion";

/**
 * Which drags the bottom sheet takes away from the list inside it. `shouldDismissSheet` is
 * pinned alongside the drawer that consumes it, in BookingDrawer's own test.
 */
describe("shouldClaimSheetDrag", () => {
  const atTop = true;
  const scrolled = false;

  it("takes a clear downward drag while the body is at its top", () => {
    expect(shouldClaimSheetDrag(40, 0, atTop)).toBe(true);
  });

  /**
   * The pair that matters. Below the threshold the gesture could still become a scroll, and
   * this runs on the capture phase, ahead of the list.
   */
  it("leaves a drag exactly at the claim distance to the list", () => {
    expect(shouldClaimSheetDrag(SHEET_CLAIM_DISTANCE, 0, atTop)).toBe(false);
  });

  it("takes one a single pixel past it", () => {
    expect(shouldClaimSheetDrag(SHEET_CLAIM_DISTANCE + 1, 0, atTop)).toBe(true);
  });

  // Scrolled down, a downward drag is the guest scrolling back up the booking.
  it("never takes a drag once the body has scrolled", () => {
    expect(shouldClaimSheetDrag(40, 0, scrolled)).toBe(false);
  });

  // At the top, an upward drag is the guest reading further down.
  it("never takes an upward drag", () => {
    expect(shouldClaimSheetDrag(-40, 0, atTop)).toBe(false);
  });

  it("never takes a mostly sideways drag", () => {
    expect(shouldClaimSheetDrag(20, 40, atTop)).toBe(false);
  });

  it("takes a diagonal one that is still mostly vertical", () => {
    expect(shouldClaimSheetDrag(40, 20, atTop)).toBe(true);
  });
});
