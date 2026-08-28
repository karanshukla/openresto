import { ADMIN_SHORTCUTS, USER_SHORTCUTS, SHORTCUTS_BY_SCOPE } from "@/constants/keyboardShortcuts";

describe("keyboardShortcuts registry", () => {
  it("does not include a '/' shortcut in the end-user scope", () => {
    // Maintainer decision (issue #140, Correction #4): no home-page search input
    // exists, so '/' must never appear in the end-user shortcut map.
    expect(USER_SHORTCUTS.some((s) => s.keys === "/")).toBe(false);
  });

  it("limits the end-user scope to l, Esc, and ?", () => {
    const keys = USER_SHORTCUTS.map((s) => s.keys).sort();
    expect(keys).toEqual(["?", "Esc", "l"].sort());
  });

  it("binds admin '/' to the bookings search", () => {
    const slash = ADMIN_SHORTCUTS.find((s) => s.keys === "/");
    expect(slash).toBeDefined();
    expect(slash?.description.toLowerCase()).toContain("search bookings");
  });

  it("includes the gopher-style admin navigation sequences", () => {
    const keys = ADMIN_SHORTCUTS.map((s) => s.keys);
    expect(keys).toEqual(expect.arrayContaining(["g d", "g b", "g l", "g s"]));
  });

  it("exposes both scopes via SHORTCUTS_BY_SCOPE", () => {
    expect(SHORTCUTS_BY_SCOPE.admin).toBe(ADMIN_SHORTCUTS);
    expect(SHORTCUTS_BY_SCOPE.user).toBe(USER_SHORTCUTS);
  });
});
