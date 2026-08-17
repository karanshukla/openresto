import { useEffect } from "react";
import { Platform } from "react-native";

/**
 * Closes something anchored to an element when the viewport resizes under it.
 *
 * A panel positioned from a one-off `getBoundingClientRect()` is correct only until its anchor
 * moves. Rather than track the anchor — which is what a positioning library would do, see
 * issue #348 — close on the event that invalidates the measurement. Closing is the conservative
 * half of the trade: a stale dropdown pointing at the wrong control is worse than one that
 * dismissed itself.
 *
 * Resize only, deliberately. Scrolling looks like the same problem and is not: the modal's
 * backdrop covers the page, so nothing behind the panel can scroll while it is open, and the one
 * thing that *can* scroll is the option list inside the panel — closing on that would slam a long
 * list shut as soon as the user reached for the option they wanted.
 *
 * @see [use-close-on-viewport-change.test.ts](../tests/hooks/use-close-on-viewport-change.test.ts)
 * — pins that a resize closes, a scroll does not, and that it unsubscribes on unmount.
 */
export function useCloseOnViewportChange(active: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!active || Platform.OS !== "web") return;

    window.addEventListener("resize", onClose);
    return () => window.removeEventListener("resize", onClose);
  }, [active, onClose]);
}
