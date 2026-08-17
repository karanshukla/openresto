import {
  anchorPanel,
  measureAnchor,
  PANEL_GAP,
  PANEL_MARGIN,
  PANEL_MAX_HEIGHT,
  PANEL_MIN_HEIGHT,
  PANEL_MIN_WIDTH,
  type TriggerRect,
} from "@/utils/selectAnchor";

const DESKTOP = { width: 1440, height: 900 };
/** A narrow phone in portrait — the booking drawer's pickers run here. */
const PHONE = { width: 360, height: 640 };

const trigger = (over: Partial<TriggerRect> = {}): TriggerRect => ({
  top: 100,
  bottom: 140,
  left: 200,
  width: 240,
  ...over,
});

describe("anchorPanel", () => {
  it("hangs the panel off the bottom of its trigger", () => {
    const panel = anchorPanel(trigger(), DESKTOP);

    expect(panel.top).toBe(140 + PANEL_GAP);
    expect(panel.left).toBe(200);
    expect(panel.width).toBe(240);
  });

  it("matches the trigger's width so the two read as one control", () => {
    expect(anchorPanel(trigger({ width: 320 }), DESKTOP).width).toBe(320);
  });

  it("widens a trigger too narrow to read the options in", () => {
    expect(anchorPanel(trigger({ width: 90 }), DESKTOP).width).toBe(PANEL_MIN_WIDTH);
  });

  // ── Flipping: the boundary is "does the list still fit below" ──────────────

  it("opens below while there is room for a full-length list", () => {
    const bottom = DESKTOP.height - PANEL_MAX_HEIGHT - PANEL_GAP - PANEL_MARGIN;

    expect(anchorPanel(trigger({ top: bottom - 40, bottom }), DESKTOP).top).toBe(
      bottom + PANEL_GAP
    );
  });

  it("flips above once the list would run off the bottom and there is more room up", () => {
    const panel = anchorPanel(trigger({ top: 800, bottom: 840 }), DESKTOP);

    expect(panel.top).toBeUndefined();
    expect(panel.bottom).toBe(DESKTOP.height - 800 + PANEL_GAP);
  });

  /**
   * A flipped panel is pinned by its bottom edge, so a list far shorter than the height cap
   * still sits against its trigger. Deriving a top from the cap instead left a three-option
   * list floating most of a screen above the control it belonged to.
   */
  it("keeps a short flipped list against its trigger rather than at the cap's distance", () => {
    const viewport = { width: 607, height: 1084 };

    const panel = anchorPanel(trigger({ top: 909, bottom: 953 }), viewport);

    // Where the panel's lower edge lands, in the same coordinates as the trigger.
    const panelBottomEdge = viewport.height - panel.bottom!;
    expect(panelBottomEdge).toBe(909 - PANEL_GAP);
    expect(panel.top).toBeUndefined();
  });

  it("stays below when the trigger is near the top, however little room there is", () => {
    const panel = anchorPanel(trigger({ top: 8, bottom: 48 }), { width: 1440, height: 200 });

    expect(panel.top).toBe(48 + PANEL_GAP);
    expect(panel.bottom).toBeUndefined();
  });

  // ── Screen edges ──────────────────────────────────────────────────────────

  it("pulls a panel back on screen when its trigger sits against the right edge", () => {
    const panel = anchorPanel(trigger({ left: 1380, width: 240 }), DESKTOP);

    expect(panel.left + panel.width).toBeLessThanOrEqual(DESKTOP.width - PANEL_MARGIN);
    expect(panel.left).toBeGreaterThanOrEqual(PANEL_MARGIN);
  });

  it("keeps a margin on the left when its trigger is flush with the edge", () => {
    expect(anchorPanel(trigger({ left: 0 }), DESKTOP).left).toBe(PANEL_MARGIN);
  });

  /**
   * Mobile web is a real target: the customer booking drawer's pickers run on phones, where a
   * panel sized to a wide trigger would hang off the side of the screen.
   */
  it("never exceeds a phone viewport, margins included", () => {
    const panel = anchorPanel(trigger({ left: 12, width: 340 }), PHONE);

    expect(panel.width).toBeLessThanOrEqual(PHONE.width - PANEL_MARGIN * 2);
    expect(panel.left).toBeGreaterThanOrEqual(PANEL_MARGIN);
    expect(panel.left + panel.width).toBeLessThanOrEqual(PHONE.width - PANEL_MARGIN);
  });

  it("gives up the minimum width rather than overflow a viewport narrower than it", () => {
    const tiny = { width: 150, height: 640 };

    const panel = anchorPanel(trigger({ left: 0, width: 140 }), tiny);

    expect(panel.width).toBe(tiny.width - PANEL_MARGIN * 2);
  });

  // ── Height ────────────────────────────────────────────────────────────────

  it("caps the list at the same length as the centred sheet", () => {
    expect(anchorPanel(trigger(), DESKTOP).maxHeight).toBe(PANEL_MAX_HEIGHT);
  });

  it("shortens the list to the room available", () => {
    const panel = anchorPanel(trigger({ top: 300, bottom: 340 }), { width: 1440, height: 600 });

    expect(panel.maxHeight).toBeLessThan(PANEL_MAX_HEIGHT);
    expect(panel.maxHeight).toBeGreaterThanOrEqual(PANEL_MIN_HEIGHT);
  });

  it("scrolls rather than collapsing to a sliver on a viewport too short for it", () => {
    const panel = anchorPanel(trigger({ top: 60, bottom: 100 }), { width: 360, height: 160 });

    expect(panel.maxHeight).toBe(PANEL_MIN_HEIGHT);
    expect(panel.top).toBe(100 + PANEL_GAP);
  });
});

/**
 * The seam between a React ref and a box on screen. Every "no" here falls back to the centred
 * sheet rather than anchoring a panel at the origin — and the middle case is the one that
 * actually happens in Jest, where a ref is a component instance with no such method.
 */
describe("measureAnchor", () => {
  it("anchors against a node that reports a box", () => {
    const node = { getBoundingClientRect: () => trigger() };

    expect(measureAnchor(node, DESKTOP)).toEqual(anchorPanel(trigger(), DESKTOP));
  });

  it("returns null for a node that cannot report one", () => {
    expect(measureAnchor({}, DESKTOP)).toBeNull();
  });

  it("returns null when there is no node at all", () => {
    expect(measureAnchor(null, DESKTOP)).toBeNull();
    expect(measureAnchor(undefined, DESKTOP)).toBeNull();
  });

  /** An element in the tree but not yet painted measures to nothing; anchoring to it would pin
   * the panel to the top-left corner. */
  it("returns null for an unpainted node with no width", () => {
    const node = { getBoundingClientRect: () => trigger({ width: 0 }) };

    expect(measureAnchor(node, DESKTOP)).toBeNull();
  });
});
