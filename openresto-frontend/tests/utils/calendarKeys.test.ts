import {
  clampToRange,
  resolveCalendarKey,
  shiftCalendarMonths,
  type CalendarKeyState,
} from "@/utils/calendarKeys";

// A whole month either side of the focused day, so a key that moves has somewhere to go and
// the range boundary only shows up in the tests that put it there deliberately.
const state = (focused: string, min = "2026-09-01", max = "2026-11-30"): CalendarKeyState => ({
  focused,
  min,
  max,
});

describe("resolveCalendarKey", () => {
  it("moves a day left and right", () => {
    expect(resolveCalendarKey("ArrowLeft", state("2026-10-14")).focused).toBe("2026-10-13");
    expect(resolveCalendarKey("ArrowRight", state("2026-10-14")).focused).toBe("2026-10-15");
  });

  it("moves a week up and down", () => {
    expect(resolveCalendarKey("ArrowUp", state("2026-10-14")).focused).toBe("2026-10-07");
    expect(resolveCalendarKey("ArrowDown", state("2026-10-14")).focused).toBe("2026-10-21");
  });

  it("moves a month on Page Up and Page Down", () => {
    expect(resolveCalendarKey("PageUp", state("2026-10-14")).focused).toBe("2026-09-14");
    expect(resolveCalendarKey("PageDown", state("2026-10-14")).focused).toBe("2026-11-14");
  });

  it("moves to the Monday and the Sunday of the focused week", () => {
    // 2026-10-14 is a Wednesday; the grid's columns run Monday first.
    expect(resolveCalendarKey("Home", state("2026-10-14")).focused).toBe("2026-10-12");
    expect(resolveCalendarKey("End", state("2026-10-14")).focused).toBe("2026-10-18");
  });

  it("leaves a Monday and a Sunday where they are", () => {
    expect(resolveCalendarKey("Home", state("2026-10-12")).focused).toBe("2026-10-12");
    expect(resolveCalendarKey("End", state("2026-10-18")).focused).toBe("2026-10-18");
  });

  it("pages the visible month by arrowing off the end of it", () => {
    expect(resolveCalendarKey("ArrowRight", state("2026-10-31")).focused).toBe("2026-11-01");
    expect(resolveCalendarKey("ArrowLeft", state("2026-10-01")).focused).toBe("2026-09-30");
  });

  it("commits on Enter and on Space, and closes on Escape", () => {
    const committed = { commit: true, handled: true };
    expect(resolveCalendarKey("Enter", state("2026-10-14"))).toEqual(committed);
    expect(resolveCalendarKey(" ", state("2026-10-14"))).toEqual(committed);
    expect(resolveCalendarKey("Escape", state("2026-10-14"))).toEqual({
      close: true,
      handled: true,
    });
  });

  /** Tab belongs to the browser, so it can still reach the month arrows either side of the grid. */
  it("leaves Tab to the browser", () => {
    expect(resolveCalendarKey("Tab", state("2026-10-14"))).toEqual({ handled: false });
  });

  it("leaves a printable key alone", () => {
    expect(resolveCalendarKey("a", state("2026-10-14"))).toEqual({ handled: false });
  });

  describe("the ends of the pickable range", () => {
    it("lands on the last pickable day rather than stepping past it", () => {
      expect(resolveCalendarKey("ArrowDown", state("2026-11-28")).focused).toBe("2026-11-30");
      expect(resolveCalendarKey("ArrowUp", state("2026-09-03")).focused).toBe("2026-09-01");
    });

    it("stays on the boundary once it is there, and still consumes the key", () => {
      const result = resolveCalendarKey("ArrowRight", state("2026-11-30"));
      expect(result.focused).toBe("2026-11-30");
      expect(result.handled).toBe(true);
    });

    it("keeps a month jump inside the range too", () => {
      expect(resolveCalendarKey("PageDown", state("2026-11-14")).focused).toBe("2026-11-30");
      expect(resolveCalendarKey("PageUp", state("2026-09-14")).focused).toBe("2026-09-01");
    });
  });
});

describe("shiftCalendarMonths", () => {
  it("keeps the day number where the target month has one", () => {
    expect(shiftCalendarMonths("2026-03-15", -1)).toBe("2026-02-15");
    expect(shiftCalendarMonths("2026-03-15", 1)).toBe("2026-04-15");
  });

  /** The month a day number can fall out of: without the clamp, January 31st becomes March 3rd. */
  it("lands on the last day of a month too short for the day number", () => {
    expect(shiftCalendarMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftCalendarMonths("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("rolls the year over at either end of it", () => {
    expect(shiftCalendarMonths("2026-12-20", 1)).toBe("2027-01-20");
    expect(shiftCalendarMonths("2026-01-20", -1)).toBe("2025-12-20");
  });
});

describe("clampToRange", () => {
  it("leaves a day inside the range alone", () => {
    expect(clampToRange("2026-10-14", "2026-09-01", "2026-11-30")).toBe("2026-10-14");
  });

  it("pulls a day outside it back to the nearer end", () => {
    expect(clampToRange("2026-08-31", "2026-09-01", "2026-11-30")).toBe("2026-09-01");
    expect(clampToRange("2026-12-01", "2026-09-01", "2026-11-30")).toBe("2026-11-30");
  });
});
