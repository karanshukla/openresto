import type { TFunction } from "i18next";

/**
 * Mirrors the backend's `UserRoles` allow-list and `AuthPolicies` gating. Keep the two in
 * sync: the server is the authority, this exists so the UI can hide what a call would refuse
 * rather than showing a control that 403s.
 */
export const ROLES = {
  owner: "Owner",
  manager: "Manager",
  /**
   * The role claim minted before multi-user support. No account carries it — only a session
   * started on an older build does — and that account is an Owner, so it grants Owner
   * capabilities here exactly as it does server-side.
   */
  legacyAdmin: "Admin",
} as const;

export const ASSIGNABLE_ROLES = [ROLES.owner, ROLES.manager] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Things a role may or may not do. One entry per gated capability. */
export type Capability = "manage:users" | "delete:location" | "view:audit";

const CAPABILITY_ROLES: Record<Capability, readonly string[]> = {
  "manage:users": [ROLES.owner, ROLES.legacyAdmin],
  "delete:location": [ROLES.owner, ROLES.legacyAdmin],
  "view:audit": [ROLES.owner, ROLES.legacyAdmin],
};

export function roleCan(role: string | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return CAPABILITY_ROLES[capability].some((r) => r.toLowerCase() === role.toLowerCase());
}

/** Human label for a role badge — unknown values pass through rather than rendering blank. */
export function roleLabel(role: string): string {
  return role === ROLES.legacyAdmin ? ROLES.owner : role;
}

/**
 * `role` is the identifier `roleLabel` resolves and the API/JWT compare against; only the
 * label this returns localizes. Shared by the users card, the activity trail, and (a later
 * PR) the sidebar — the one place a role identifier becomes display text.
 *
 * @see [roles.test.ts](../tests/constants/roles.test.ts) — pins that both roles render their
 * translated label, the legacy `Admin` claim renders as Owner's, and an unrecognised value
 * passes through untranslated.
 * @see [UsersCard.test.tsx](../tests/components/admin/settings/UsersCard.test.tsx) — pins that
 * the users card shows the translated label at every render site while `adminUpdateUserRole`
 * still receives the raw role identifier.
 */
export function roleDisplayLabel(role: string, t: TFunction): string {
  const resolved = roleLabel(role);
  switch (resolved) {
    case ROLES.owner:
      return t("common.roles.owner");
    case ROLES.manager:
      return t("common.roles.manager");
    default:
      return resolved;
  }
}
