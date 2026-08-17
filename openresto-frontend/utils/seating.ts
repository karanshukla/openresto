/**
 * Which bookable units can take a party — the client's copy of the server's `Restaurant.CanSeat`.
 * Every dropdown, suggested pick and eligibility list runs through this, because a unit offered
 * here that the API then rejects reads to the diner as a broken booking form rather than as a
 * capacity rule.
 *
 * @see [seating.test.ts](../tests/utils/seating.test.ts) — pins the boundary on both sides of the
 * oversize cap, and that no cap means no upper bound.
 */

/** A location's optional cap on spare seats over the party size. Null means unrestricted. */
export type OversizeCap = number | null | undefined;

export function canSeat(unitSeats: number, partySize: number, cap: OversizeCap): boolean {
  if (unitSeats < partySize) return false;
  return cap == null || unitSeats - partySize <= cap;
}

export function seatsAtLeast<T>(
  units: T[],
  partySize: number,
  cap: OversizeCap,
  capacityOf: (unit: T) => number
): T[] {
  return units.filter((unit) => canSeat(capacityOf(unit), partySize, cap));
}
