/**
 * Shared a11y/highlight helpers for bookings-list rows — kept identical between
 * the wide-table and mobile-card layouts so keyboard-focus state can't silently
 * drift between the two renderings.
 */

/**
 * Accessibility + testID props for a bookings-list row.
 * `testID: booking-row-${id}` is asserted by the screen-level integration tests,
 * so keep this stable.
 */
export function rowA11yProps(id: number, focusedRowId: number | null) {
  return {
    testID: `booking-row-${id}`,
    accessibilityRole: "button" as const,
    accessibilityState: { selected: id === focusedRowId },
  };
}

/**
 * Inline background tint applied to the keyboard-focused row.
 * Returns `undefined` when the row isn't focused (ignored in RN style arrays).
 */
export function focusedRowHighlight(
  id: number,
  focusedRowId: number | null,
  primaryColor: string
): { backgroundColor: string } | undefined {
  return id === focusedRowId ? { backgroundColor: `${primaryColor}0D` } : undefined;
}
