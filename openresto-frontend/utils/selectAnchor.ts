/**
 * Where a `Select`'s options panel goes on web, so it hangs off its trigger like a dropdown
 * rather than floating in the middle of the screen.
 *
 * Kept as pure geometry, separate from the component, because the interesting part is the
 * clamping: the panel has to stay on screen when the trigger sits near an edge, and mobile web
 * is a real target — the booking drawer's pickers run on phones, where a panel sized to its
 * content would happily hang off the side.
 *
 * @see [selectAnchor.test.ts](../tests/utils/selectAnchor.test.ts) — pins each clamp on both
 * sides of its boundary: opening below vs flipping above, and the left/width limits at both
 * screen edges.
 */

/** The bit of a DOMRect this needs. Kept structural so a test needn't build a real rect. */
export interface TriggerRect {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

export interface Viewport {
  width: number;
  height: number;
}

/**
 * Exactly one of <c>top</c>/<c>bottom</c> is set, and which one is the whole point.
 *
 * Opening downward pins the panel's top edge under the trigger. Opening upward pins its
 * <em>bottom</em> edge above it — computing a top from the height cap instead would leave a
 * short list floating a full 360px above the control it belongs to, which is what it did.
 */
export interface AnchoredPanel {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
}

/** Distance between the trigger and the panel. */
export const PANEL_GAP = 6;
/** Smallest gap kept between the panel and the edge of the screen. */
export const PANEL_MARGIN = 8;
/** A panel narrower than this is unreadable, even under a narrow trigger. */
export const PANEL_MIN_WIDTH = 180;
/** Matches the centred sheet's cap, so the two forms scroll at the same length. */
export const PANEL_MAX_HEIGHT = 360;
/**
 * Below this the panel is useless, so a viewport too short for it gets a scrolling panel that
 * overlaps its trigger rather than a sliver.
 */
export const PANEL_MIN_HEIGHT = 120;

/** Anything that can report its own on-screen box — in practice, a DOM node. */
export interface Measurable {
  getBoundingClientRect?: () => TriggerRect;
}

/**
 * The panel position for a trigger, or null when there is nothing to measure — no node, a node
 * that cannot report a box, or a box with no width because it has not been painted.
 *
 * Takes the node as `unknown` on purpose. A React Native ref is a DOM node only on web; under
 * react-test-renderer it is a component instance with no `getBoundingClientRect` at all, and
 * that difference is exactly the case this has to return null for rather than assume.
 */
export function measureAnchor(node: unknown, viewport: Viewport): AnchoredPanel | null {
  const rect = (node as Measurable | null)?.getBoundingClientRect?.();
  if (!rect?.width) return null;

  return anchorPanel(rect, viewport);
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function anchorPanel(trigger: TriggerRect, viewport: Viewport): AnchoredPanel {
  const available = viewport.width - PANEL_MARGIN * 2;
  const width = clamp(trigger.width, Math.min(PANEL_MIN_WIDTH, available), available);
  const left = clamp(trigger.left, PANEL_MARGIN, viewport.width - width - PANEL_MARGIN);

  const spaceBelow = viewport.height - trigger.bottom - PANEL_GAP - PANEL_MARGIN;
  const spaceAbove = trigger.top - PANEL_GAP - PANEL_MARGIN;

  // Below is the default; flipping up is for a trigger low enough that the list would run off
  // the bottom, and only when there is genuinely more room the other way.
  const opensBelow = spaceBelow >= PANEL_MAX_HEIGHT || spaceBelow >= spaceAbove;
  const room = opensBelow ? spaceBelow : spaceAbove;
  const maxHeight = Math.max(PANEL_MIN_HEIGHT, Math.min(PANEL_MAX_HEIGHT, room));

  return opensBelow
    ? { top: trigger.bottom + PANEL_GAP, left, width, maxHeight }
    : { bottom: viewport.height - trigger.top + PANEL_GAP, left, width, maxHeight };
}
