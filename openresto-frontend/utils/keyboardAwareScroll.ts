/**
 * Breathing room left between the focused field and the top of the keyboard, so it lands clear
 * of the edge rather than flush against it.
 */
export const FIELD_SCROLL_PADDING = 24;

export interface FieldKeyboardGeometry {
  /** The field's bottom edge in window coordinates, from `measureInWindow`. */
  fieldBottom: number;
  /** The keyboard's top edge in window coordinates — `endCoordinates.screenY`. */
  keyboardTop: number;
  /** Where the scroller currently sits in its content. */
  scrollOffset: number;
  padding?: number;
}

/**
 * Where a scroller should move to lift a focused field clear of the keyboard, or `null` when the
 * field is already above it and should be left alone.
 *
 * Both edges are window coordinates, which is what makes this work inside the booking sheet as
 * well as on a plain screen: the field is measured where it actually is on the display, so
 * nothing has to know whether the sheet resized around the keyboard, moved up, or did neither.
 * An earlier attempt measured the field against the scroller's content view instead, which the
 * sheet's scroller does not expose at all — so it silently did nothing there.
 *
 * Returning `null` for a field already in the clear is the point: scrolling on every focus makes
 * the form lurch as the guest moves between fields that were never covered.
 *
 * @see [keyboardAwareScroll.test.ts](../tests/utils/keyboardAwareScroll.test.ts) — pins both
 * sides of the boundary: a field one pixel clear stays put, one pixel under scrolls.
 */
export function scrollOffsetForField({
  fieldBottom,
  keyboardTop,
  scrollOffset,
  padding = FIELD_SCROLL_PADDING,
}: FieldKeyboardGeometry): number | null {
  // No keyboard reported yet, so there is nothing to be clear of and no measurement to trust.
  if (keyboardTop <= 0) return null;

  const covered = fieldBottom + padding - keyboardTop;
  if (covered <= 0) return null;

  return Math.max(0, scrollOffset + covered);
}
