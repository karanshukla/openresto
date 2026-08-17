import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, type View } from "react-native";
import {
  measureAnchor,
  samePanel,
  type AnchorOptions,
  type AnchoredPanel,
} from "@/utils/anchoredPanel";

export interface AnchorTracking {
  /** Where the panel sits, or null for the centred sheet — native, or an unmeasurable trigger. */
  panel: AnchoredPanel | null;
  /** Measure the trigger. Call it in the press handler, before the panel is shown. */
  measure: () => void;
  /** Forget the measurement, on close. */
  release: () => void;
}

/**
 * Keeps an anchored panel pinned to its trigger for as long as it is open.
 *
 * Measuring once at open time is correct only until the anchor moves, which it does on every
 * scroll and resize. The predecessor closed the panel on a resize instead — the conservative
 * half of the trade, since a dropdown pointing at the wrong control is worse than one that
 * dismissed itself, but a workaround for not tracking rather than a fix (issue #348).
 *
 * `measure` is deliberately imperative rather than an effect on `visible`: reading the box in
 * the press handler puts the panel at its final position on the first frame, where an effect
 * would render it centred and correct it afterwards.
 *
 * Scroll is listened for in the capture phase, because the scroll that moves a trigger is
 * usually a container's rather than the window's and those do not bubble. That also picks up
 * the option list scrolling inside the panel, where the trigger has not moved at all — hence
 * `samePanel`, which drops the re-render that would otherwise land on every frame of it.
 *
 * @see [use-anchor-tracking.test.ts](../tests/hooks/use-anchor-tracking.test.ts) — pins that
 * a scroll and a resize both re-measure, that an unchanged box does not re-render, that a
 * trigger which stops reporting a box keeps its last position rather than falling back to the
 * centred sheet mid-interaction, and that native never subscribes.
 */
export function useAnchorTracking(
  triggerRef: React.RefObject<View | null>,
  options: AnchorOptions = {}
): AnchorTracking {
  const [panel, setPanel] = useState<AnchoredPanel | null>(null);
  const { align, width } = options;

  const read = useCallback(
    () =>
      measureAnchor(
        triggerRef.current,
        { width: window.innerWidth, height: window.innerHeight },
        { align, width }
      ),
    [triggerRef, align, width]
  );

  const measure = useCallback(() => {
    if (Platform.OS !== "web") return;
    setPanel(read());
  }, [read]);

  const release = useCallback(() => setPanel(null), []);

  const tracking = panel !== null;
  const readRef = useRef(read);
  readRef.current = read;

  useEffect(() => {
    if (!tracking || Platform.OS !== "web") return;

    let frame = 0;
    const update = () => {
      frame = 0;
      // A trigger that stops reporting a box is nearly always a transient (a re-render between
      // commits), so the last good position is a better answer than the centred sheet, which
      // would visibly tear the panel off its control.
      setPanel((current) => {
        const next = readRef.current() ?? current;
        return samePanel(current, next) ? current : next;
      });
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [tracking]);

  return { panel, measure, release };
}
