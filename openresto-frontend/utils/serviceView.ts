import type { TimelinePlacement, TimelineRowGroup, TimelineUnit } from "@/utils/bookingTimeline";

/**
 * A table with a sitting arriving within this window is not offerable to a walk-in, so the floor
 * reads it as turning over rather than free.
 *
 * @see [serviceView.test.ts](../tests/utils/serviceView.test.ts) — pins that a table whose next
 * sitting is exactly this far out reads as turning, and one a minute further out reads as free.
 */
export const TURNAROUND_MINUTES = 30;

export type UnitStatus = "seated" | "turning" | "free";

export interface UnitOccupancy {
  unit: TimelineUnit;
  status: UnitStatus;
  /** The sitting covering the observed moment, if any. */
  current: TimelinePlacement | null;
  /** The next sitting to start after it, whether or not the unit is occupied now. */
  next: TimelinePlacement | null;
  /** Minutes until the current sitting ends. Zero when nothing is sitting there. */
  minutesRemaining: number;
  /** Minutes until the next sitting starts; null when nothing else is booked. */
  minutesUntilNext: number | null;
}

export interface ServiceSection {
  key: string;
  /** Carried through from the row block, so the view can label the synthetic blocks in its locale. */
  kind: TimelineRowGroup["kind"];
  name: string;
  units: UnitOccupancy[];
}

export interface ServiceSummary {
  seated: number;
  turning: number;
  free: number;
  /** Covers sitting at the observed moment — the number front of house is actually serving. */
  covers: number;
}

/**
 * A unit's occupancy at one moment, in timeline-offset minutes. A sitting owns its table from its
 * start up to but not including its end, so a table whose sitting ends at 20:00 is free at 20:00
 * rather than double-counted against the sitting that starts there.
 *
 * @see [serviceView.test.ts](../tests/utils/serviceView.test.ts) — pins that a unit is seated at
 * its sitting's start minute and free at its end minute.
 */
function occupancyFor(
  unit: TimelineUnit,
  placements: TimelinePlacement[],
  at: number
): UnitOccupancy {
  const ordered = [...placements].sort((a, b) => a.startOffset - b.startOffset);
  const current = ordered.find((p) => at >= p.startOffset && at < p.endOffset) ?? null;
  const next = ordered.find((p) => p.startOffset > at) ?? null;

  const minutesRemaining = current ? current.endOffset - at : 0;
  const minutesUntilNext = next ? next.startOffset - at : null;

  const status: UnitStatus = current
    ? "seated"
    : minutesUntilNext != null && minutesUntilNext <= TURNAROUND_MINUTES
      ? "turning"
      : "free";

  return { unit, status, current, next, minutesRemaining, minutesUntilNext };
}

/**
 * The unit keys that share physical seating with each other: a combinable group with each of its
 * member tables, both ways round. Pushing two tables together does not conjure a third table, so a
 * sitting booked on either side occupies both.
 */
function sharedSeating(rows: TimelineRowGroup[]): Map<string, string[]> {
  const shared = new Map<string, string[]>();
  const link = (from: string, to: string) => {
    const list = shared.get(from);
    if (list) list.push(to);
    else shared.set(from, [to]);
  };

  for (const row of rows) {
    for (const unit of row.units) {
      for (const memberKey of unit.memberKeys) {
        link(unit.key, memberKey);
        link(memberKey, unit.key);
      }
    }
  }

  return shared;
}

/**
 * The floor as it stands at one moment: every bookable unit under its section, each carrying who is
 * on it, how much of their sitting is left, and what arrives next.
 *
 * Rows come from the timetable's own `buildUnitRows`, so a combinable group is a unit beside its
 * member tables rather than a replacement for them, and the two views can never disagree about what
 * is bookable. Placements likewise come from `buildTimeline`, which has already resolved a missing
 * end time and unwrapped a service that runs past midnight.
 *
 * A unit is read against the sittings on its own key *and* those on the units it shares seating
 * with, so a party seated at a combined group occupies its member tables too. Drawing a member as
 * free while its group is occupied is the same room read two different ways.
 *
 * @see [serviceView.test.ts](../tests/utils/serviceView.test.ts) — pins that a group booking lands
 * on its group unit and seats its member tables, that a member's own booking occupies its group,
 * that a unit with nothing booked reads free, and that sections keep their order.
 */
export function buildServiceFloor({
  rows,
  placements,
  at,
}: {
  rows: TimelineRowGroup[];
  placements: TimelinePlacement[];
  /** Observed moment, as minutes from the timeline's left edge. */
  at: number;
}): ServiceSection[] {
  const byUnit = new Map<string, TimelinePlacement[]>();
  for (const placement of placements) {
    const list = byUnit.get(placement.unitKey);
    if (list) list.push(placement);
    else byUnit.set(placement.unitKey, [placement]);
  }

  const shared = sharedSeating(rows);
  const sittingsOn = (key: string): TimelinePlacement[] => [
    ...(byUnit.get(key) ?? []),
    ...(shared.get(key) ?? []).flatMap((other) => byUnit.get(other) ?? []),
  ];

  return rows.map((row) => ({
    key: row.key,
    kind: row.kind,
    name: row.name,
    units: row.units.map((unit) => occupancyFor(unit, sittingsOn(unit.key), at)),
  }));
}

/**
 * Floor totals at the observed moment. Covers counts guests actually seated, not the day's bookings,
 * which is the number a pass on the room is checked against.
 *
 * The statuses count tables, because tables are what there is a finite number of: a combinable group
 * is its member tables rather than seating beside them, and the unassigned row is no seating at all.
 * Counting either as a unit of its own is what let an eight-table room report ten free. Covers are
 * counted per sitting instead, so a party seated on a group is one party however many units carry
 * it — and a party whose table was deleted is still in the room and still on the total.
 *
 * @see [serviceView.test.ts](../tests/utils/serviceView.test.ts) — pins that a group and its members
 * count once between them, that the unassigned unit is no table but its party is still covers, and
 * that the three statuses partition the room's tables.
 */
export function summarise(sections: ServiceSection[]): ServiceSummary {
  const summary: ServiceSummary = { seated: 0, turning: 0, free: 0, covers: 0 };
  const counted = new Set<number>();

  for (const section of sections) {
    for (const occupancy of section.units) {
      if (occupancy.unit.kind === "table") summary[occupancy.status] += 1;

      const sitting = occupancy.current;
      if (sitting && !counted.has(sitting.booking.id)) {
        counted.add(sitting.booking.id);
        summary.covers += sitting.booking.seats;
      }
    }
  }

  return summary;
}

/**
 * Splits a span of minutes into whole hours and the remaining minutes, so a caller can pick the
 * hours-and-minutes, hours-only or minutes-only phrasing its locale needs rather than having an
 * English "1h 30m" baked in here.
 *
 * @see [serviceView.test.ts](../tests/utils/serviceView.test.ts) — pins that a whole number of
 * hours leaves no remainder and that a negative span floors at zero.
 */
export function splitDuration(minutes: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.round(minutes));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}
