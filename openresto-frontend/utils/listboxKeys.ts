/**
 * Keyboard behaviour for a popup list of choices — the `Select`'s options, the navbar menu's
 * commands — as a pure function of the key and the list's current state.
 *
 * Pure because the alternative is a switch buried in a DOM event handler, where every branch
 * needs a browser to reach and none of them can be pinned. The component keeps the state and
 * owns the effects (focus, scrolling, the type-ahead timer); everything about *what a key
 * means* lives here.
 *
 * @see [listboxKeys.test.ts](../tests/utils/listboxKeys.test.ts) — pins each key, and both
 * sides of the two boundaries that differ by control: wrapping vs clamping at the ends of the
 * list, and whether Space commits or types.
 */

/** How far Page Up/Down jumps. Matches the browser's own behaviour in a native `<select>`. */
export const PAGE_JUMP = 10;

/** How long a type-ahead burst stays open before the next keystroke starts a new search. */
export const TYPEAHEAD_RESET_MS = 500;

export interface ListboxKeyState {
  /** The highlighted option, or -1 when nothing is highlighted yet. */
  activeIndex: number;
  /** Option labels in order. Type-ahead matches a typed prefix against these. */
  labels: string[];
  /** What has been typed so far in the current type-ahead burst. */
  typeahead: string;
  /**
   * Whether moving past the end comes back round to the start. Menus wrap, matching every
   * other menu a person uses; a listbox clamps, matching a native `<select>`.
   */
  wrap: boolean;
}

export interface ListboxKeyResult {
  /** The option to highlight, when this key moved the highlight. */
  activeIndex?: number;
  /** Take the highlighted option and close. */
  commit?: boolean;
  /** Close, taking nothing. */
  close?: boolean;
  /** The type-ahead buffer after this key. */
  typeahead: string;
  /**
   * Whether the list consumed the key. An unhandled key is left to the browser, which is what
   * lets Tab move focus out of an open list rather than being swallowed by it.
   */
  handled: boolean;
}

function step(from: number, delta: number, count: number, wrap: boolean): number {
  if (count === 0) return -1;
  // From nothing highlighted, either direction enters the list at the end it came from.
  if (from < 0) return delta > 0 ? 0 : count - 1;
  const next = from + delta;
  if (next >= 0 && next < count) return next;
  if (!wrap) return Math.min(Math.max(next, 0), count - 1);
  return (next + count) % count;
}

/**
 * The first option whose label starts with `prefix`, searching forward from `from` and
 * wrapping, or -1 for no match.
 */
function matchPrefix(labels: string[], prefix: string, from: number): number {
  const needle = prefix.toLowerCase();
  for (let i = 0; i < labels.length; i++) {
    const index = (from + i + labels.length) % labels.length;
    if (labels[index].toLowerCase().startsWith(needle)) return index;
  }
  return -1;
}

/** Whether the key produces a character, rather than being a named control key. */
const isPrintable = (key: string) => key.length === 1;

export function resolveListboxKey(key: string, state: ListboxKeyState): ListboxKeyResult {
  const { activeIndex, labels, typeahead, wrap } = state;
  const count = labels.length;
  const moved = (index: number): ListboxKeyResult => ({
    activeIndex: index,
    typeahead: "",
    handled: true,
  });

  switch (key) {
    case "ArrowDown":
      return moved(step(activeIndex, 1, count, wrap));
    case "ArrowUp":
      return moved(step(activeIndex, -1, count, wrap));
    case "Home":
      return moved(count === 0 ? -1 : 0);
    case "End":
      return moved(count - 1);
    case "PageDown":
      return moved(step(activeIndex, PAGE_JUMP, count, false));
    case "PageUp":
      return moved(step(activeIndex, -PAGE_JUMP, count, false));
    case "Enter":
      return { commit: true, typeahead: "", handled: true };
    case "Escape":
      return { close: true, typeahead: "", handled: true };
    // Deliberately unhandled: closing and letting the browser move focus onward is what a Tab
    // out of an open list should do, and swallowing it would strand the keyboard inside.
    case "Tab":
      return { close: true, typeahead: "", handled: false };
  }

  // Space is the one key whose meaning depends on the state: it commits the highlighted option,
  // except mid-search, where it is a character in a label like "Table 12".
  if (key === " " && typeahead === "") {
    return { commit: true, typeahead: "", handled: true };
  }

  if (isPrintable(key) && count > 0) {
    const next = typeahead + key;
    // A first keystroke looks past the current option, so pressing the same letter twice walks
    // through the options starting with it; a continuing burst re-matches from where it is, so
    // refining a prefix does not skip the option already found.
    const from = typeahead === "" ? activeIndex + 1 : Math.max(activeIndex, 0);
    const found = matchPrefix(labels, next, from);
    return found === -1
      ? { typeahead: next, handled: true }
      : { activeIndex: found, typeahead: next, handled: true };
  }

  return { typeahead, handled: false };
}

/**
 * Where a key pressed on a closed trigger should leave the highlight, or null for a key that
 * does not open the list at all.
 *
 * Enter and Space are absent on purpose: react-native-web already turns both into a press on
 * the trigger, so claiming them here would open the list and immediately act on it again.
 */
export function openIndexFor(
  key: string,
  from: number,
  labels: string[],
  wrap: boolean
): number | null {
  if (key !== "ArrowDown" && key !== "ArrowUp" && key !== "Home" && key !== "End") return null;
  return resolveListboxKey(key, { activeIndex: from, labels, typeahead: "", wrap }).activeIndex!;
}
