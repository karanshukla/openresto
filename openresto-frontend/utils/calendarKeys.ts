/**
 * Keyboard behaviour for a month grid of days — the web date picker's calendar — as a pure
 * function of the key and the grid's current state.
 *
 * Pure for the same reason `listboxKeys` is: the alternative is a switch buried in a DOM event
 * handler, where every branch needs a browser to reach and none of them can be pinned. The
 * component keeps the state and owns the effects (moving focus, paging the visible month);
 * everything about *what a key means* lives here.
 *
 * Dates are local `YYYY-MM-DD` strings throughout, which is what the picker passes around and
 * what makes the range comparisons plain string comparisons.
 *
 * @see [calendarKeys.test.ts](../tests/utils/calendarKeys.test.ts) — pins each key, and both
 * sides of the two boundaries: the ends of the allowed range, and the short month a step back
 * from the 31st has to land inside.
 */

const DAYS_IN_WEEK = 7;

export interface CalendarKeyState {
  /** The day holding the highlight. */
  focused: string;
  /** Earliest selectable day, inclusive. */
  min: string;
  /** Latest selectable day, inclusive. */
  max: string;
}

export interface CalendarKeyResult {
  /** The day to highlight, when this key moved the highlight. */
  focused?: string;
  /** Take the highlighted day and close. */
  commit?: boolean;
  /** Close, taking nothing. */
  close?: boolean;
  /**
   * Whether the grid consumed the key. An unhandled key is left to the browser, which is what
   * lets Tab move between the month arrows and the grid rather than being swallowed by it.
   */
  handled: boolean;
}

function parse(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function format(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDays(iso: string, days: number): string {
  const date = parse(iso);
  date.setDate(date.getDate() + days);
  return format(date);
}

/**
 * The same day number `months` away, or that month's last day where it has no such day: a step
 * back from the 31st of March lands on the 28th of February, not the 3rd of March.
 */
export function shiftCalendarMonths(iso: string, months: number): string {
  const date = parse(iso);
  const targetMonth = date.getMonth() + months;
  const lastDay = new Date(date.getFullYear(), targetMonth + 1, 0).getDate();
  return format(new Date(date.getFullYear(), targetMonth, Math.min(date.getDate(), lastDay)));
}

/** Holds a day inside the pickable range, so no key can leave the grid on a day nobody can take. */
export function clampToRange(iso: string, min: string, max: string): string {
  if (iso < min) return min;
  if (iso > max) return max;
  return iso;
}

/** Monday of the given day's week, matching the Monday-first columns the grid draws. */
function startOfWeek(iso: string): string {
  const jsDay = parse(iso).getDay();
  const isoDay = jsDay === 0 ? DAYS_IN_WEEK : jsDay;
  return shiftDays(iso, 1 - isoDay);
}

/**
 * Both Enter and Space commit, and the caller has to refuse a day whose cell would have refused
 * it: neither key goes through the cell's own press, so `disabled` does not stop them. A
 * `gridcell` is a `div`, and react-native-web only presses on Space for a `button`; Enter's own
 * default action would activate the nearest ancestor with one, which inside a modal is the
 * backdrop that closes it. Consuming both is what keeps the day cell's key where it belongs.
 */
export function resolveCalendarKey(key: string, state: CalendarKeyState): CalendarKeyResult {
  const { focused, min, max } = state;
  const moved = (iso: string): CalendarKeyResult => ({
    focused: clampToRange(iso, min, max),
    handled: true,
  });

  switch (key) {
    case "ArrowLeft":
      return moved(shiftDays(focused, -1));
    case "ArrowRight":
      return moved(shiftDays(focused, 1));
    case "ArrowUp":
      return moved(shiftDays(focused, -DAYS_IN_WEEK));
    case "ArrowDown":
      return moved(shiftDays(focused, DAYS_IN_WEEK));
    case "PageUp":
      return moved(shiftCalendarMonths(focused, -1));
    case "PageDown":
      return moved(shiftCalendarMonths(focused, 1));
    case "Home":
      return moved(startOfWeek(focused));
    case "End":
      return moved(shiftDays(startOfWeek(focused), DAYS_IN_WEEK - 1));
    case "Enter":
    case " ":
      return { commit: true, handled: true };
    case "Escape":
      return { close: true, handled: true };
  }

  return { handled: false };
}
