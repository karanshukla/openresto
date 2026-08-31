import type { TFunction } from "i18next";
import type { TimelineRowGroup, TimelineUnit } from "@/utils/bookingTimeline";

/**
 * Row-block and unit labels shared by the timetable and the service floor, so the two views of one
 * service can't drift on what the combined block is called.
 *
 * `buildUnitRows` is a pure util and stays one: it emits the kind of block a row is and leaves the
 * words to whichever view is drawing them. A label built there would be English on a French floor.
 */

/** The heading over a block of rows: the section's own name, or UI copy for the synthetic blocks. */
export function rowGroupLabel(row: Pick<TimelineRowGroup, "kind" | "name">, t: TFunction): string {
  if (row.kind === "groups") return t("admin.bookings.timetable.combinedRow");
  if (row.kind === "unassigned") return t("admin.bookings.timetable.unassignedRow");
  return row.name;
}

/** A unit's name: the table's or group's own, or UI copy for the row standing in for no seating. */
export function unitLabel(unit: Pick<TimelineUnit, "kind" | "name">, t: TFunction): string {
  return unit.kind === "unassigned" ? t("admin.bookings.timetable.unassignedUnit") : unit.name;
}
