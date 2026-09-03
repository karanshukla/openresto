import { FIELD_SCROLL_PADDING, scrollOffsetForField } from "@/utils/keyboardAwareScroll";

/** A keyboard covering the bottom third of a tall phone. */
const KEYBOARD_TOP = 1800;

const geometry = (over: Partial<Parameters<typeof scrollOffsetForField>[0]> = {}) => ({
  fieldBottom: 1000,
  keyboardTop: KEYBOARD_TOP,
  scrollOffset: 0,
  ...over,
});

describe("scrollOffsetForField", () => {
  it("leaves a field well clear of the keyboard alone", () => {
    expect(scrollOffsetForField(geometry())).toBeNull();
  });

  /**
   * The pair that matters, one pixel either side. Scrolling for a field that was already clear
   * is what makes a form lurch as the guest moves between fields.
   */
  it("leaves a field whose padded bottom just clears the keyboard", () => {
    const fieldBottom = KEYBOARD_TOP - FIELD_SCROLL_PADDING;

    expect(scrollOffsetForField(geometry({ fieldBottom }))).toBeNull();
  });

  it("scrolls for a field one pixel further down than that", () => {
    const fieldBottom = KEYBOARD_TOP - FIELD_SCROLL_PADDING + 1;

    expect(scrollOffsetForField(geometry({ fieldBottom }))).toBe(1);
  });

  it("lifts the field by exactly how much the keyboard covers", () => {
    expect(scrollOffsetForField(geometry({ fieldBottom: 1900 }))).toBe(
      1900 + FIELD_SCROLL_PADDING - KEYBOARD_TOP
    );
  });

  // The scroller moves from where it already is, not from the top of the content.
  it("adds the shortfall to the offset the scroller is already at", () => {
    expect(scrollOffsetForField(geometry({ fieldBottom: 1900, scrollOffset: 500 }))).toBe(
      500 + 1900 + FIELD_SCROLL_PADDING - KEYBOARD_TOP
    );
  });

  it("never scrolls past the top of the content", () => {
    expect(scrollOffsetForField(geometry({ fieldBottom: 1900, scrollOffset: -5000 }))).toBe(0);
  });

  /**
   * Focus can arrive before the keyboard does. With nothing measurable to be clear of, guessing
   * would scroll the form for no reason — `keyboardDidShow` runs it again a moment later.
   */
  it("does nothing before a keyboard has been reported", () => {
    expect(scrollOffsetForField(geometry({ fieldBottom: 1900, keyboardTop: 0 }))).toBeNull();
  });
});
