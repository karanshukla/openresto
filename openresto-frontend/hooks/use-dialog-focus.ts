import { useEffect, type RefObject } from "react";
import { Platform, type View } from "react-native";

/**
 * Moves keyboard focus into a popup while it is open and puts it back where it came from
 * afterwards.
 *
 * Without the restore, dismissing a dialog drops focus at the top of the document and a
 * keyboard user has to tab back to where they were. Without moving focus in, the keys the
 * popup listens for never reach it — react-native-web's `Modal` focuses the first focusable
 * descendant it can find, which is the full-screen backdrop, not the panel.
 *
 * The target needs `tabIndex={-1}` to be focusable without joining the tab order.
 *
 * @see [use-dialog-focus.test.tsx](../tests/hooks/use-dialog-focus.test.tsx) — pins the focus
 * and the restore, and that a closed popup touches neither.
 */
export function useDialogFocus(visible: boolean, ref: RefObject<View | null>): void {
  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;
    const previous = (globalThis as { document?: Document }).document
      ?.activeElement as HTMLElement | null;
    (ref.current as unknown as HTMLElement | null)?.focus?.();
    return () => previous?.focus?.();
  }, [visible, ref]);
}
