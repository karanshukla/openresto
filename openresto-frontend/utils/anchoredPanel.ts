/**
 * Where a panel goes when it hangs off a trigger on web — a `Select`'s option list, the
 * navbar's overflow menu — so it reads as a dropdown rather than floating in the middle of
 * the screen.
 *
 * Kept as pure geometry, separate from the components, because the interesting part is the
 * clamping: the panel has to stay on screen when the trigger sits near an edge, and mobile web
 * is a real target — the booking drawer's pickers run on phones, where a panel sized to its
 * content would happily hang off the side.
 *
 * @see [anchoredPanel.test.ts](../tests/utils/anchoredPanel.test.ts) — pins each clamp on both
 * sides of its boundary: opening below vs flipping above, the left/width limits at both screen
 * edges, and right-alignment for a panel wider than the icon it hangs off.
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
 * Which of the trigger's vertical edges the panel lines up with. A panel that matches its
 * trigger's width grows from the left; one that is wider than its trigger (a menu hanging off
 * an icon button) has to grow the other way or it runs off the screen.
 */
export type PanelAlign = "start" | "end";

export interface AnchorOptions {
  align?: PanelAlign;
  /** Fixed panel width, for a panel that should not simply match its trigger. */
  width?: number;
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
export function measureAnchor(
  node: unknown,
  viewport: Viewport,
  options: AnchorOptions = {}
): AnchoredPanel | null {
  const rect = (node as Measurable | null)?.getBoundingClientRect?.();
  if (!rect?.width) return null;

  return anchorPanel(rect, viewport, options);
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function anchorPanel(
  trigger: TriggerRect,
  viewport: Viewport,
  { align = "start", width: fixedWidth }: AnchorOptions = {}
): AnchoredPanel {
  const available = viewport.width - PANEL_MARGIN * 2;
  const desired = fixedWidth ?? Math.max(trigger.width, Math.min(PANEL_MIN_WIDTH, available));
  const width = Math.min(desired, available);
  const unclampedLeft = align === "end" ? trigger.left + trigger.width - width : trigger.left;
  const left = clamp(unclampedLeft, PANEL_MARGIN, viewport.width - width - PANEL_MARGIN);

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

/**
 * Whether two measurements describe the same box. Anchor tracking re-measures on every scroll
 * frame, and the common case is that nothing moved — comparing here keeps a scroll of the
 * option list itself from re-rendering the panel 60 times a second.
 */
export function samePanel(a: AnchoredPanel | null, b: AnchoredPanel | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.top === b.top &&
    a.bottom === b.bottom &&
    a.left === b.left &&
    a.width === b.width &&
    a.maxHeight === b.maxHeight
  );
}
