import type { BookingDetailDto, SectionWithTables } from "@/api/admin";
import type { TableGroupDto } from "@/api/restaurants";
import { minutesInTimezone } from "@/utils/date";
import { groupDisplayName } from "@/utils/tableGroups";

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_HOUR = 60;

/** 12-hour clock labels, indexed by 24-hour hour. Midnight reads 12a, not 0a. */
const HOUR_LABELS = Array.from({ length: 24 }, (_, h) =>
  h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`
);

/** A row on the timetable: one bookable unit, or the catch-all for bookings that lost theirs. */
export interface TimelineUnit {
  /** Stable row identity. A table and a group can share a numeric id, so the kind is part of it. */
  key: string;
  kind: "table" | "group" | "unassigned";
  /** Admin-authored name. Empty on the unassigned unit, whose label is UI copy the view resolves. */
  name: string;
  /** Null for the unassigned row, which stands for no physical seating. */
  seats: number | null;
  /**
   * Unit keys of the member tables a combinable group is made of; empty for anything else. A group
   * and its members are the same physical seating, which is what lets a reader of these rows tell
   * a second bookable unit from a second table.
   */
  memberKeys: string[];
}

export interface TimelineRowGroup {
  key: string;
  /** What the block is: a real section, the combinable groups, or the catch-all. */
  kind: "section" | "groups" | "unassigned";
  /** Admin-authored section name. Empty on the two synthetic blocks, whose labels are UI copy. */
  name: string;
  units: TimelineUnit[];
}

export interface TimelinePlacement {
  booking: BookingDetailDto;
  unitKey: string;
  /** Minutes from the timeline's left edge. */
  startOffset: number;
  endOffset: number;
  /** Restaurant-local minutes since midnight the sitting starts at, for the bar's own label. */
  startClockMinutes: number;
  /** Stacking row within the unit, so two overlapping sittings are both visible. */
  lane: number;
}

export interface Timeline {
  /** Minutes from opening at the left edge; negative when a booking predates the open time. */
  startOffset: number;
  endOffset: number;
  ticks: { offset: number; label: string }[];
  placements: TimelinePlacement[];
  /** Lanes each unit needs, so a row can grow to fit overlapping sittings. */
  laneCount: Record<string, number>;
}

export const UNASSIGNED_KEY = "unassigned";

/**
 * The unit a booking occupies. `tableId` and `tableGroupId` are mutually exclusive — a group
 * booking stores no table — so a placement keyed on the table alone drops every group booking.
 * Deleting a table nulls the booking's FK rather than cascading, leaving bookings that belong to no
 * unit at all; those land on the unassigned row rather than disappearing.
 */
export function unitKeyFor(booking: Pick<BookingDetailDto, "tableId" | "tableGroupId">): string {
  if (booking.tableGroupId != null) return `group:${booking.tableGroupId}`;
  if (booking.tableId != null) return `table:${booking.tableId}`;
  return UNASSIGNED_KEY;
}

function parseClockMinutes(value: string): number {
  const [h, m] = value.split(":");
  return ((parseInt(h, 10) || 0) % 24) * MINUTES_PER_HOUR + (parseInt(m, 10) || 0);
}

/**
 * Rows for the timetable: every table under its section, then combinable groups under a trailing
 * block of their own. A member table stays individually bookable, so a group is an extra row rather
 * than a replacement for its members' rows. Groups are restaurant-scoped and may span sections,
 * which is why they get their own block instead of being filed under one.
 *
 * The two synthetic blocks and the unassigned unit carry a `kind` and no name: this is a pure util,
 * so the words belong to whichever view is drawing them rather than to an English string baked in
 * here. A group carries its `memberKeys` so a reader can tell a second bookable unit from a second
 * physical table.
 *
 * @see [bookingTimeline.test.ts](../tests/utils/bookingTimeline.test.ts) — pins that the combined
 * and unassigned blocks are named by kind rather than by a hardcoded label, and that a group row
 * carries the keys of its member tables.
 */
export function buildUnitRows(
  sections: SectionWithTables[],
  groups: TableGroupDto[] = [],
  options: { includeUnassigned?: boolean } = {}
): TimelineRowGroup[] {
  const rows: TimelineRowGroup[] = sections.map((section) => ({
    key: `section:${section.id}`,
    kind: "section" as const,
    name: section.name,
    units: section.tables.map((table) => ({
      key: `table:${table.id}`,
      kind: "table" as const,
      name: table.name ?? `T${table.id}`,
      seats: table.seats,
      memberKeys: [],
    })),
  }));

  if (groups.length > 0) {
    rows.push({
      key: "groups",
      kind: "groups",
      name: "",
      units: groups.map((group) => ({
        key: `group:${group.id}`,
        kind: "group" as const,
        name: groupDisplayName(group),
        seats: group.combinedSeats,
        memberKeys: group.members.map((member) => `table:${member.id}`),
      })),
    });
  }

  if (options.includeUnassigned) {
    rows.push({
      key: "unassigned",
      kind: "unassigned",
      name: "",
      units: [{ key: UNASSIGNED_KEY, kind: "unassigned", name: "", seats: null, memberKeys: [] }],
    });
  }

  return rows;
}

/** Signed distance from opening, choosing whichever side of the day wrap the booking sits nearer. */
function unwrap(offsetFromOpen: number, serviceSpan: number): number {
  if (offsetFromOpen <= serviceSpan) return offsetFromOpen;
  const forward = offsetFromOpen - serviceSpan;
  const backward = MINUTES_PER_DAY - offsetFromOpen;
  return backward < forward ? offsetFromOpen - MINUTES_PER_DAY : offsetFromOpen;
}

function assignLanes(placements: TimelinePlacement[]): Record<string, number> {
  const laneEnds: Record<string, number[]> = {};

  for (const placement of [...placements].sort((a, b) => a.startOffset - b.startOffset)) {
    const ends = (laneEnds[placement.unitKey] ??= []);
    const free = ends.findIndex((end) => end <= placement.startOffset);
    const lane = free === -1 ? ends.length : free;
    ends[lane] = placement.endOffset;
    placement.lane = lane;
  }

  return Object.fromEntries(Object.entries(laneEnds).map(([key, ends]) => [key, ends.length]));
}

/** Headroom drawn either side of the day's sittings, so a bar never butts against the edge. */
const WINDOW_PAD_MINUTES = 60;

/**
 * The drawn range, as [start, end] offsets from opening. Trims idle service hours away from the
 * sittings, but never trims a sitting itself, and never pads into hours the location is shut.
 */
function windowFor(
  placements: TimelinePlacement[],
  serviceSpan: number,
  nowMinutes: number | null,
  openMinutes: number
): [number, number] {
  if (placements.length === 0) return [0, serviceSpan];

  const earliest = Math.min(...placements.map((p) => p.startOffset));
  const latest = Math.max(...placements.map((p) => p.endOffset));
  // Pad outwards, but no further than the service window — unless a booking is already out there.
  let start = Math.max(earliest - WINDOW_PAD_MINUTES, Math.min(0, earliest));
  let end = Math.min(latest + WINDOW_PAD_MINUTES, Math.max(serviceSpan, latest));

  if (nowMinutes != null) {
    // "Who is sitting where right now" is the question the grid exists to answer, so the marker's
    // position stays on the axis even when the nearest sitting is hours away — inside service only.
    const nowOffsetRaw = (nowMinutes - openMinutes + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    if (nowOffsetRaw <= serviceSpan) {
      start = Math.min(start, nowOffsetRaw);
      end = Math.max(end, nowOffsetRaw);
    }
  }

  return [start, end];
}

function durationOf(booking: BookingDetailDto, defaultDurationMinutes: number): number {
  if (!booking.endTime) return defaultDurationMinutes;
  const minutes = Math.round(
    (new Date(booking.endTime).getTime() - new Date(booking.date).getTime()) / 60000
  );
  return minutes > 0 ? minutes : defaultDurationMinutes;
}

/**
 * Lays the day out in minutes rather than hours, so a sitting is drawn where it actually starts and
 * for as long as it actually runs. Bucketing by the hour is what collapsed an 18:00 and an 18:30
 * booking on one table into a single cell and rendered only the first of them.
 *
 * The window is the day's sittings plus an hour of headroom either side, and "now" when the caller
 * passes one. It is not the service hours: a location open around the clock would otherwise spend 24
 * columns to show two lunchtime bookings, burying them off the right of the screen. The headroom
 * stops at the service window, so hours the location is shut stay off the axis — but a booking
 * outside those hours still sets the edge itself, because narrowing a location's hours leaves the
 * bookings taken under the old ones where they are and the timetable is the worst place to hide them.
 *
 * With no bookings at all the window falls back to the service hours; callers render their own empty
 * state rather than an empty grid.
 *
 * @see [bookingTimeline.test.ts](../tests/utils/bookingTimeline.test.ts) — pins that two sittings
 * half an hour apart on one table both place, that a group booking places on its group row, that the
 * window trims to the sittings rather than spanning idle service hours, that a booking outside the
 * service hours still widens it, and that overlapping sittings stack into lanes.
 */
export function buildTimeline({
  openTime,
  closeTime,
  timezone,
  bookings,
  defaultDurationMinutes,
  nowMinutes = null,
}: {
  openTime: string;
  closeTime: string;
  timezone: string;
  bookings: BookingDetailDto[];
  defaultDurationMinutes: number;
  /** Restaurant-local minutes since midnight, or null on any day but the location's today. */
  nowMinutes?: number | null;
}): Timeline {
  const openMinutes = parseClockMinutes(openTime);
  const closeMinutes = parseClockMinutes(closeTime);
  const serviceSpan =
    (closeMinutes - openMinutes + MINUTES_PER_DAY) % MINUTES_PER_DAY || MINUTES_PER_DAY;

  const placements: TimelinePlacement[] = bookings.map((booking) => {
    const startClockMinutes = minutesInTimezone(booking.date, timezone);
    const startOffset = unwrap(
      (startClockMinutes - openMinutes + MINUTES_PER_DAY) % MINUTES_PER_DAY,
      serviceSpan
    );
    return {
      booking,
      unitKey: unitKeyFor(booking),
      startOffset,
      endOffset: startOffset + durationOf(booking, defaultDurationMinutes),
      startClockMinutes,
      lane: 0,
    };
  });

  const laneCount = assignLanes(placements);

  const [rawStart, rawEnd] = windowFor(placements, serviceSpan, nowMinutes, openMinutes);
  // Snap the edges to clock hours so every tick lands on a labelled hour rather than mid-column.
  const startOffset =
    Math.floor((openMinutes + rawStart) / MINUTES_PER_HOUR) * MINUTES_PER_HOUR - openMinutes;
  const endOffset =
    Math.ceil((openMinutes + rawEnd) / MINUTES_PER_HOUR) * MINUTES_PER_HOUR - openMinutes;

  const ticks: { offset: number; label: string }[] = [];
  for (let offset = startOffset; offset < endOffset; offset += MINUTES_PER_HOUR) {
    const clockMinute =
      (((openMinutes + offset) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    ticks.push({ offset, label: HOUR_LABELS[Math.floor(clockMinute / MINUTES_PER_HOUR)] });
  }

  return { startOffset, endOffset, ticks, placements, laneCount };
}

/**
 * Where "now" falls on the timeline, or null when it is off the drawn window. Callers pass null for
 * `nowMinutes` on any day other than the restaurant's today, where "now" has no place on the grid.
 */
export function nowOffset(
  timeline: Timeline,
  openTime: string,
  nowMinutes: number | null
): number | null {
  if (nowMinutes == null) return null;
  const openMinutes = parseClockMinutes(openTime);
  const raw = (nowMinutes - openMinutes + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const offset = raw > timeline.endOffset ? raw - MINUTES_PER_DAY : raw;
  return offset >= timeline.startOffset && offset <= timeline.endOffset ? offset : null;
}

/**
 * The restaurant-local clock time a timeline offset falls on. Offsets are measured from the day's
 * open time, so a view that draws its own labels needs this rather than re-deriving the open
 * minute — and it stays right on a day with no bookings to read one off.
 */
export function clockMinutesAt(openTime: string, offset: number): number {
  return parseClockMinutes(openTime) + offset;
}

/** Compact "1h 30m left" / "45m left" for what is left of a sitting. */
export function formatRemaining(minutes: number): string {
  if (minutes <= 0) return "ending";
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const mins = minutes % MINUTES_PER_HOUR;
  if (hours === 0) return `${mins}m left`;
  return mins === 0 ? `${hours}h left` : `${hours}h ${mins}m left`;
}

/** Restaurant-local minutes since midnight rendered as a compact "6:30p". */
export function formatClockMinutes(totalMinutes: number): string {
  const wrapped = ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour24 = Math.floor(wrapped / MINUTES_PER_HOUR);
  const minute = wrapped % MINUTES_PER_HOUR;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")}${hour24 < 12 ? "a" : "p"}`;
}
