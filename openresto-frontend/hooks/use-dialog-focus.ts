import { useEffect, type RefObject } from "react";
import { Platform, type View } from "react-native";

/**
 * The popups currently holding focus, innermost last. Only the innermost one takes focus back,
 * so a picker opened from inside a dialog and the dialog it opened from don't pull the same
 * focus between them forever.
 */
const openPopups: HTMLElement[] = [];

/**
 * Moves keyboard focus into a popup while it is open and puts it back where it came from
 * afterwards.
 *
 * Without the restore, dismissing a dialog drops focus at the top of the document and a
 * keyboard user has to tab back to where they were. Without moving focus in, the keys the
 * popup listens for never reach it — react-native-web's `Modal` focuses the first focusable
 * descendant it can find, which is the full-screen backdrop, not the panel.
 *
 * That trap has to be fought off afterwards, not just beaten to the punch. It activates when
 * the open animation ends — a frame or more after this hook has run — and for a popup opened
 * from inside another `Modal` (the booking sheet's pickers) the two modals' traps hand focus
 * back and forth until it settles on the backdrop, leaving every key the panel listens for
 * landing somewhere else. So focus is re-taken whenever it lands outside the popup.
 *
 * The target needs `tabIndex={-1}` to be focusable without joining the tab order.
 *
 * @see [use-dialog-focus.test.tsx](../tests/hooks/use-dialog-focus.test.tsx) — pins the focus
 * and the restore, that a closed popup touches neither, that focus taken off an open popup
 * comes back, and that only the innermost of two open popups reclaims it.
 */
export function useDialogFocus(visible: boolean, ref: RefObject<View | null>): void {
  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;
    const doc = (globalThis as { document?: Document }).document;
    const previous = doc?.activeElement as HTMLElement | null;
    const panel = ref.current as unknown as HTMLElement | null;
    // Registered before it takes focus, not after: the popup it opened from is still the
    // innermost one until then, and would reclaim the focus this is in the middle of moving.
    if (panel) openPopups.push(panel);
    panel?.focus?.();

    const reclaim = (event: FocusEvent) => {
      if (!panel || openPopups[openPopups.length - 1] !== panel) return;
      const target = event.target as Node | null;
      if (target && !panel.contains(target)) panel.focus?.();
    };
    doc?.addEventListener("focusin", reclaim, true);

    return () => {
      doc?.removeEventListener("focusin", reclaim, true);
      const index = panel ? openPopups.lastIndexOf(panel) : -1;
      if (index !== -1) openPopups.splice(index, 1);
      previous?.focus?.();
    };
  }, [visible, ref]);
}
