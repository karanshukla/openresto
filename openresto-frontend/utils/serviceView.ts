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
 * The floor as it stands at one moment: every bookable unit under its section, each carrying who is
 * on it, how much of their sitting is left, and what arrives next.
 *
 * Rows come from the timetable's own `buildUnitRows`, so a combinable group is a unit beside its
 * member tables rather than a replacement for them, and the two views can never disagree about what
 * is bookable. Placements likewise come from `buildTimeline`, which has already resolved a missing
 * end time and unwrapped a service that runs past midnight.
 *
 * @see [serviceView.test.ts](../tests/utils/serviceView.test.ts) — pins that a group booking lands
 * on its group unit, that a unit with nothing booked reads free, and that sections keep their order.
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

  return rows.map((row) => ({
    key: row.key,
    name: row.name,
    units: row.units.map((unit) => occupancyFor(unit, byUnit.get(unit.key) ?? [], at)),
  }));
}

/**
 * Floor totals at the observed moment. Covers counts guests actually seated, not the day's bookings,
 * which is the number a pass on the room is checked against.
 *
 * @see [serviceView.test.ts](../tests/utils/serviceView.test.ts) — pins that covers count only
 * seated units and that the three statuses partition the floor.
 */
export function summarise(sections: ServiceSection[]): ServiceSummary {
  const summary: ServiceSummary = { seated: 0, turning: 0, free: 0, covers: 0 };

  for (const section of sections) {
    for (const occupancy of section.units) {
      summary[occupancy.status] += 1;
      if (occupancy.status === "seated" && occupancy.current) {
        summary.covers += occupancy.current.booking.seats;
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
