import i18n from "@/i18n";
import { ASSIGNABLE_ROLES, ROLES, roleCan, roleDisplayLabel, roleLabel } from "@/constants/roles";

const t = i18n.getFixedT("en");

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

    it("lets only an Owner manage API keys", () => {
      expect(roleCan(ROLES.owner, "manage:api-keys")).toBe(true);
      expect(roleCan(ROLES.legacyAdmin, "manage:api-keys")).toBe(true);
      expect(roleCan(ROLES.manager, "manage:api-keys")).toBe(false);
    });

    it("lets only an Owner delete a location", () => {
      expect(roleCan(ROLES.owner, "delete:location")).toBe(true);
      expect(roleCan(ROLES.legacyAdmin, "delete:location")).toBe(true);
      expect(roleCan(ROLES.manager, "delete:location")).toBe(false);
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

  describe("roleDisplayLabel", () => {
    it("translates the Owner label", () => {
      expect(roleDisplayLabel(ROLES.owner, t)).toBe("Owner");
    });

    it("translates the Manager label", () => {
      expect(roleDisplayLabel(ROLES.manager, t)).toBe("Manager");
    });

    it("resolves the legacy Admin claim to the translated Owner label", () => {
      expect(roleDisplayLabel(ROLES.legacyAdmin, t)).toBe("Owner");
    });

    it("passes an unrecognised role through untranslated", () => {
      expect(roleDisplayLabel("Host", t)).toBe("Host");
    });

    it("translates independently of the raw identifier roleLabel resolves", () => {
      const fr = i18n.getFixedT("fr");
      expect(roleDisplayLabel(ROLES.owner, fr)).toBe("Propriétaire");
      expect(roleLabel(ROLES.owner)).toBe("Owner");
    });
  });
});
