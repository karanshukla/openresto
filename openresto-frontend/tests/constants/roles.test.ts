import { ASSIGNABLE_ROLES, ROLES, roleCan, roleLabel } from "@/constants/roles";

describe("roles", () => {
  it("only offers Owner and Manager for assignment", () => {
    expect(ASSIGNABLE_ROLES).toEqual([ROLES.owner, ROLES.manager]);
  });

  describe("roleCan", () => {
    it("lets an Owner manage users", () => {
      expect(roleCan(ROLES.owner, "manage:users")).toBe(true);
    });

    it("does not let a Manager manage users", () => {
      expect(roleCan(ROLES.manager, "manage:users")).toBe(false);
    });

    it("treats the retired Admin claim as an Owner", () => {
      // A session started before multi-user existed belongs to what is now an Owner.
      expect(roleCan(ROLES.legacyAdmin, "manage:users")).toBe(true);
    });

    it("is case-insensitive", () => {
      expect(roleCan("owner", "manage:users")).toBe(true);
    });

    it("grants nothing without a role", () => {
      expect(roleCan(null, "manage:users")).toBe(false);
      expect(roleCan(undefined, "manage:users")).toBe(false);
      expect(roleCan("", "manage:users")).toBe(false);
    });

    it("grants nothing for an unrecognised role", () => {
      expect(roleCan("Host", "manage:users")).toBe(false);
    });
  });

  describe("roleLabel", () => {
    it("shows a legacy Admin session as Owner", () => {
      expect(roleLabel(ROLES.legacyAdmin)).toBe(ROLES.owner);
    });

    it("passes other roles through unchanged", () => {
      expect(roleLabel(ROLES.manager)).toBe("Manager");
      expect(roleLabel("Host")).toBe("Host");
    });
  });
});
