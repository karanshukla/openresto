import { openIndexFor, resolveListboxKey, PAGE_JUMP } from "@/utils/listboxKeys";

const LABELS = ["Anyone", "Ada Lovelace", "Alan Turing", "Grace Hopper", "Bob"];

const at = (activeIndex: number, over: Partial<{ typeahead: string; wrap: boolean }> = {}) => ({
  activeIndex,
  labels: LABELS,
  typeahead: "",
  wrap: false,
  ...over,
});

describe("moving the highlight", () => {
  it("steps down and up one option at a time", () => {
    expect(resolveListboxKey("ArrowDown", at(1)).activeIndex).toBe(2);
    expect(resolveListboxKey("ArrowUp", at(2)).activeIndex).toBe(1);
  });

  /** Nothing highlighted yet: each direction enters the list at the end it came from. */
  it("enters an unhighlighted list from the matching end", () => {
    expect(resolveListboxKey("ArrowDown", at(-1)).activeIndex).toBe(0);
    expect(resolveListboxKey("ArrowUp", at(-1)).activeIndex).toBe(LABELS.length - 1);
  });

  it("jumps to the first and last option", () => {
    expect(resolveListboxKey("Home", at(2)).activeIndex).toBe(0);
    expect(resolveListboxKey("End", at(2)).activeIndex).toBe(LABELS.length - 1);
  });

  it("pages by a screenful, stopping at the ends", () => {
    const long = { ...at(0), labels: Array.from({ length: 40 }, (_, i) => `Table ${i}`) };

    expect(resolveListboxKey("PageDown", long).activeIndex).toBe(PAGE_JUMP);
    expect(resolveListboxKey("PageUp", { ...long, activeIndex: 3 }).activeIndex).toBe(0);
  });

  /**
   * The pair that separates the two controls built on this: a value picker clamps like a native
   * `<select>`, a command menu comes back round like every other menu.
   */
  it("clamps at the ends when it does not wrap", () => {
    expect(resolveListboxKey("ArrowDown", at(LABELS.length - 1)).activeIndex).toBe(
      LABELS.length - 1
    );
    expect(resolveListboxKey("ArrowUp", at(0)).activeIndex).toBe(0);
  });

  it("comes back round at the ends when it does", () => {
    expect(resolveListboxKey("ArrowDown", at(LABELS.length - 1, { wrap: true })).activeIndex).toBe(
      0
    );
    expect(resolveListboxKey("ArrowUp", at(0, { wrap: true })).activeIndex).toBe(LABELS.length - 1);
  });

  it("has nowhere to go in an empty list", () => {
    const empty = { activeIndex: -1, labels: [], typeahead: "", wrap: false };

    expect(resolveListboxKey("ArrowDown", empty).activeIndex).toBe(-1);
    expect(resolveListboxKey("Home", empty).activeIndex).toBe(-1);
    expect(resolveListboxKey("End", empty).activeIndex).toBe(-1);
  });
});

describe("committing and closing", () => {
  it("takes the highlighted option on Enter", () => {
    expect(resolveListboxKey("Enter", at(2))).toMatchObject({ commit: true, handled: true });
  });

  it("closes on Escape without taking anything", () => {
    const result = resolveListboxKey("Escape", at(2));

    expect(result.close).toBe(true);
    expect(result.commit).toBeUndefined();
  });

  /**
   * Tab is the one key the list closes on but does not consume: swallowing it would leave the
   * keyboard stranded inside a list it just dismissed.
   */
  it("closes on Tab and lets the browser move focus on", () => {
    expect(resolveListboxKey("Tab", at(2))).toMatchObject({ close: true, handled: false });
  });

  it("leaves a key it has no use for to the browser", () => {
    expect(resolveListboxKey("F5", at(2))).toMatchObject({ handled: false });
  });
});

/**
 * Space is the one key whose meaning depends on the state, and both readings are load-bearing:
 * it commits, except mid-search, where "Table 12" cannot be typed without it.
 */
describe("Space", () => {
  it("commits when nothing is being typed", () => {
    expect(resolveListboxKey(" ", at(1))).toMatchObject({ commit: true });
  });

  it("is a character mid-search", () => {
    const result = resolveListboxKey(" ", at(1, { typeahead: "grace" }));

    expect(result.commit).toBeUndefined();
    expect(result.typeahead).toBe("grace ");
  });
});

describe("type-ahead", () => {
  it("jumps to the first option starting with the letter", () => {
    expect(resolveListboxKey("g", at(0)).activeIndex).toBe(3);
  });

  it("refines as more letters arrive", () => {
    const first = resolveListboxKey("a", at(-1));
    expect(first.activeIndex).toBe(0); // "Anyone"

    const second = resolveListboxKey("l", {
      ...at(first.activeIndex!),
      typeahead: first.typeahead,
    });
    expect(second.typeahead).toBe("al");
    expect(second.activeIndex).toBe(2); // "Alan Turing"
  });

  it("is case-insensitive", () => {
    expect(resolveListboxKey("G", at(0)).activeIndex).toBe(3);
  });

  /** Repeating a letter walks through the options starting with it rather than sticking. */
  it("cycles through the options sharing a first letter", () => {
    expect(resolveListboxKey("a", at(0)).activeIndex).toBe(1); // past "Anyone" to "Ada"
    expect(resolveListboxKey("a", at(1)).activeIndex).toBe(2); // on to "Alan"
  });

  it("wraps round the end of the list when searching", () => {
    expect(resolveListboxKey("a", at(4)).activeIndex).toBe(0);
  });

  it("keeps the buffer but holds the highlight when nothing matches", () => {
    const result = resolveListboxKey("z", at(2));

    expect(result.activeIndex).toBeUndefined();
    expect(result.typeahead).toBe("z");
    expect(result.handled).toBe(true);
  });

  it("clears the buffer as soon as a navigation key arrives", () => {
    expect(resolveListboxKey("ArrowDown", at(1, { typeahead: "gr" })).typeahead).toBe("");
  });

  it("has nothing to search in an empty list", () => {
    const result = resolveListboxKey("a", {
      activeIndex: -1,
      labels: [],
      typeahead: "",
      wrap: false,
    });

    expect(result.handled).toBe(false);
  });
});

/**
 * Enter and Space are absent by design: react-native-web already turns both into a press on the
 * trigger, so claiming them here would open the list and act on it in the same keystroke.
 */
describe("openIndexFor", () => {
  const open = (key: string, from = -1, wrap = false) => openIndexFor(key, from, LABELS, wrap);

  it("opens at the end the arrow came from", () => {
    expect(open("ArrowDown")).toBe(0);
    expect(open("ArrowUp")).toBe(LABELS.length - 1);
  });

  it("opens where the control already stands", () => {
    expect(open("ArrowDown", 1)).toBe(2);
  });

  it("opens at the end Home and End name, whatever the current value", () => {
    expect(open("Home", 3)).toBe(0);
    expect(open("End", 3)).toBe(LABELS.length - 1);
  });

  it("leaves the press keys to the trigger itself", () => {
    expect(["Enter", " ", "Escape", "a"].map((k) => open(k))).toEqual([null, null, null, null]);
  });
});
