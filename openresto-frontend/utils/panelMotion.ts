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
