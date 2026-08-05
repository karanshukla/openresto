/**
 * Naming + membership helpers for combinable table groups (#271–#274), shared by the diner
 * booking dropdown and the seating minimap so the two can't drift apart on what a group is
 * called. A group is named by the admin or, when unnamed, by its member tables.
 */

export interface TableGroupLike {
  name?: string | null;
  combinedSeats: number;
  members: { id: number; name?: string | null }[];
}

/** Member table names joined for display, e.g. "T1 + T2". Falls back to the id for unnamed tables. */
function memberNames(group: TableGroupLike): string {
  return group.members.map((m) => m.name ?? m.id).join(" + ");
}

/**
 * The group's display name on its own, with no capacity suffix — for surfaces that show the
 * seat count separately (the seating minimap renders it on its own line).
 */
export function groupDisplayName(group: TableGroupLike): string {
  return group.name ?? `Tables ${memberNames(group)}`;
}

/**
 * Single-line label for the booking form's table dropdown, where the capacity has to ride along
 * in the same string. Named groups read "Window booths (5 seats)"; unnamed ones spell out the
 * members so the diner knows which tables get pushed together.
 */
export function groupDropdownLabel(group: TableGroupLike): string {
  return group.name
    ? `${group.name} (${group.combinedSeats} seats)`
    : `Tables ${memberNames(group)} (${group.combinedSeats} seats combined)`;
}

/**
 * Ids of every table that belongs to some group. Used to deprioritize combinable tables in
 * auto-assign ordering and to mark them in the seating minimap — a member table stays
 * individually bookable, so this is a display/ordering hint, never a filter (#242).
 */
export function groupedTableIds(groups: TableGroupLike[]): Set<number> {
  return new Set(groups.flatMap((g) => g.members.map((m) => m.id)));
}
