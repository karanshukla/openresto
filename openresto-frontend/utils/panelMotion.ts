/**
 * Timing and gesture constants for the side-panel/bottom-sheet chrome, shared by
 * BookingDrawer (the booking form) and SlidePanel (the lookup result panel) so both
 * enter, exit and dismiss the same way without either importing the other's module —
 * BookingDrawer pulls in expo-router, expo-haptics and the whole booking form graph,
 * which a plain result panel has no business depending on just to reuse four numbers.
 */

/** How far the sheet animates before it is considered gone. */
export const SHEET_EXIT_DISTANCE = 800;
/** How far the side panel travels as it fades in and out. */
export const SIDE_ENTER_DISTANCE = 28;
/**
 * Short on purpose. The list/form column beside the panel does not animate — the panel
 * takes its layout width the instant it mounts — so a long entrance leaves the diner
 * looking at the gap where the panel is about to be.
 */
export const SIDE_ENTER_MS = 150;
export const SIDE_EXIT_MS = 120;

/**
 * Whether a drag on the sheet's handle should dismiss it: either dragged far enough to
 * read as deliberate, or flicked down hard enough that a short drag still means "go away".
 */
export function shouldDismissSheet(dy: number, vy: number): boolean {
  return dy > 120 || (dy > 40 && vy > 0.7);
}

/**
 * How far a drag has to travel before the sheet takes it away from the body's own scroller.
 * Larger than `shouldDismissSheet`'s threshold on purpose: this one runs on the capture phase,
 * ahead of the list, so it has to be sure the gesture is a drag and not the start of a scroll.
 */
export const SHEET_CLAIM_DISTANCE = 8;

/**
 * Whether the sheet, rather than the list inside it, owns a drag in progress.
 *
 * A sheet draggable only by its handle reads as a sheet that cannot be dragged, because the
 * card is the part under the thumb. Claiming every drag instead would stop the list scrolling,
 * so the gate is the scroll position: at the top of the content there is nothing left to
 * scroll down to, and a downward drag can only mean the sheet.
 *
 * @see [panelMotion.test.ts](../tests/utils/panelMotion.test.ts) — pins both sides of each
 * boundary: at the top versus scrolled, downward versus up, vertical versus sideways.
 */
export function shouldClaimSheetDrag(dy: number, dx: number, bodyAtTop: boolean): boolean {
  return bodyAtTop && dy > SHEET_CLAIM_DISTANCE && Math.abs(dy) > Math.abs(dx);
}
