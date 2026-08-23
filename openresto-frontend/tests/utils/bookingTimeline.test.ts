import {
  buildTimeline,
  buildUnitRows,
  formatClockMinutes,
  formatRemaining,
  nowOffset,
  unitKeyFor,
  UNASSIGNED_KEY,
} from "@/utils/bookingTimeline";
import type { BookingDetailDto, SectionWithTables } from "@/api/admin";

const DAY = "2026-08-23";

/** A booking starting at `hhmm` UTC, `minutes` long. Seats/ids are noise for placement. */
function booking(
  id: number,
  hhmm: string,
  minutes: number | null,
  unit: { tableId?: number | null; tableGroupId?: number | null } = { tableId: 1 }
): BookingDetailDto {
  const date = `${DAY}T${hhmm}:00.000Z`;
  return {
    id,
    restaurantId: 1,
    restaurantName: "Test",
    timezone: "UTC",
    sectionId: 1,
    sectionName: "Main",
    tableId: unit.tableId ?? null,
    tableGroupId: unit.tableGroupId ?? null,
    tableName: "T1",
    date,
    endTime:
      minutes == null
        ? undefined
        : new Date(new Date(date).getTime() + minutes * 60000).toISOString(),
    customerEmail: `guest${id}@test.com`,
    seats: 2,
  };
}

const sections: SectionWithTables[] = [
  { id: 1, name: "Main", tables: [{ id: 1, name: "T1", seats: 4 }] },
];

const base = {
  openTime: "17:00",
  closeTime: "23:00",
  timezone: "UTC",
  defaultDurationMinutes: 90,
};

describe("unitKeyFor", () => {
  it("keys a single-table booking on its table", () => {
    expect(unitKeyFor({ tableId: 7, tableGroupId: null })).toBe("table:7");
  });

  it("keys a group booking on its group, which carries no table id at all", () => {
    expect(unitKeyFor({ tableId: null, tableGroupId: 5 })).toBe("group:5");
  });

  it("falls back to the unassigned row when the table was deleted out from under it", () => {
    expect(unitKeyFor({ tableId: null, tableGroupId: null })).toBe(UNASSIGNED_KEY);
  });
});

describe("buildUnitRows", () => {
  it("gives a combinable group its own row without removing its member tables", () => {
    const rows = buildUnitRows(sections, [
      { id: 5, name: null, combinedSeats: 7, members: [{ id: 1, name: "T1", seats: 4 }] },
    ]);

    expect(rows.map((r) => r.name)).toEqual(["Main", "Combined tables"]);
    expect(rows[0].units.map((u) => u.key)).toEqual(["table:1"]);
    expect(rows[1].units[0]).toMatchObject({ key: "group:5", name: "Tables T1", seats: 7 });
  });

  it("names a group by its own label when the admin gave it one", () => {
    const rows = buildUnitRows(sections, [
      {
        id: 5,
        name: "Window booths",
        combinedSeats: 7,
        members: [{ id: 1, name: "T1", seats: 4 }],
      },
    ]);

    expect(rows[1].units[0].name).toBe("Window booths");
  });

  it("omits the combined block entirely when the location has no groups", () => {
    expect(buildUnitRows(sections, []).map((r) => r.key)).toEqual(["section:1"]);
  });

  it("adds the unassigned row only when asked for it", () => {
    expect(buildUnitRows(sections, [], { includeUnassigned: true }).at(-1)?.key).toBe("unassigned");
    expect(buildUnitRows(sections, []).at(-1)?.key).toBe("section:1");
  });
});

describe("buildTimeline placement", () => {
  it("places two sittings half an hour apart on one table rather than collapsing them", () => {
    const timeline = buildTimeline({
      ...base,
      bookings: [booking(1, "18:00", 60), booking(2, "18:30", 60)],
    });

    expect(timeline.placements).toHaveLength(2);
    expect(timeline.placements.map((p) => p.startOffset)).toEqual([60, 90]);
  });

  it("sizes a bar by its stored end time, not by the hour it starts in", () => {
    const timeline = buildTimeline({ ...base, bookings: [booking(1, "18:00", 150)] });

    const [placement] = timeline.placements;
    expect(placement.endOffset - placement.startOffset).toBe(150);
  });

  it("falls back to the location's default duration for a booking stored without an end", () => {
    const timeline = buildTimeline({ ...base, bookings: [booking(1, "18:00", null)] });

    const [placement] = timeline.placements;
    expect(placement.endOffset - placement.startOffset).toBe(90);
  });

  it("places a group booking on its group row, where it carries no table id", () => {
    const timeline = buildTimeline({
      ...base,
      bookings: [booking(1, "18:00", 60, { tableGroupId: 5 })],
    });

    expect(timeline.placements[0].unitKey).toBe("group:5");
  });

  it("resolves the start against the restaurant's zone, not the machine's", () => {
    const utc = buildTimeline({ ...base, bookings: [booking(1, "18:00", 60)] });
    const newYork = buildTimeline({
      ...base,
      timezone: "America/New_York",
      bookings: [booking(1, "18:00", 60)],
    });

    // 18:00Z is 14:00 in New York — three hours before a 17:00 open, so it lands off the left.
    expect(utc.placements[0].startOffset).toBe(60);
    expect(newYork.placements[0].startOffset).toBe(-180);
  });
});

describe("buildTimeline lanes", () => {
  it("stacks overlapping sittings on one table into separate lanes", () => {
    const timeline = buildTimeline({
      ...base,
      bookings: [booking(1, "18:00", 120), booking(2, "18:30", 60)],
    });

    expect(timeline.placements.map((p) => p.lane)).toEqual([0, 1]);
    expect(timeline.laneCount["table:1"]).toBe(2);
  });

  it("reuses a lane once the earlier sitting has ended", () => {
    const timeline = buildTimeline({
      ...base,
      bookings: [booking(1, "18:00", 60), booking(2, "19:00", 60)],
    });

    expect(timeline.placements.map((p) => p.lane)).toEqual([0, 0]);
    expect(timeline.laneCount["table:1"]).toBe(1);
  });

  it("counts lanes per unit, so a busy table does not stretch a quiet one", () => {
    const timeline = buildTimeline({
      ...base,
      bookings: [
        booking(1, "18:00", 120, { tableId: 1 }),
        booking(2, "18:30", 60, { tableId: 1 }),
        booking(3, "18:00", 60, { tableId: 2 }),
      ],
    });

    expect(timeline.laneCount).toEqual({ "table:1": 2, "table:2": 1 });
  });
});

describe("buildTimeline window", () => {
  it("trims the idle service hours away from the day's sittings", () => {
    // Service runs 5p-11p but the only sitting is 6p-7p, so six columns of nothing become three.
    const timeline = buildTimeline({ ...base, bookings: [booking(1, "18:00", 60)] });

    expect(timeline.ticks.map((t) => t.label)).toEqual(["5p", "6p", "7p"]);
  });

  it("keeps an hour of headroom either side of the sittings", () => {
    // 7p-8p sitting, so the axis runs 6p-9p: three columns, the last of them covering 8p-9p.
    const timeline = buildTimeline({ ...base, bookings: [booking(1, "19:00", 60)] });

    expect(timeline.ticks.map((t) => t.label)).toEqual(["6p", "7p", "8p"]);
    expect(timeline.endOffset).toBe(240);
  });

  it("does not pad into hours the location is shut", () => {
    // The 5p sitting starts on opening; there is no 4p column to pad into.
    const timeline = buildTimeline({ ...base, bookings: [booking(1, "17:00", 60)] });

    expect(timeline.startOffset).toBe(0);
    expect(timeline.ticks[0].label).toBe("5p");
  });

  it("falls back to the service hours when the day holds no bookings to trim to", () => {
    const timeline = buildTimeline({ ...base, bookings: [] });

    expect([timeline.startOffset, timeline.endOffset]).toEqual([0, 360]);
  });

  it("keeps now on the axis when the nearest sitting is hours away", () => {
    // Two lunchtime sittings on a location open around the clock: the marker still has to land.
    const timeline = buildTimeline({
      ...base,
      openTime: "00:00",
      closeTime: "23:59",
      bookings: [booking(1, "14:30", 60)],
      nowMinutes: 10 * 60,
    });

    expect(timeline.ticks[0].label).toBe("10a");
    expect(timeline.ticks.at(-1)?.label).toBe("4p");
  });

  it("ignores a now that falls outside the service window", () => {
    const timeline = buildTimeline({
      ...base,
      bookings: [booking(1, "18:00", 60)],
      nowMinutes: 60,
    });

    expect(timeline.ticks.map((t) => t.label)).toEqual(["5p", "6p", "7p"]);
  });

  it("widens backwards for a booking taken before the location's current open time", () => {
    const timeline = buildTimeline({ ...base, bookings: [booking(1, "15:00", 60)] });

    expect(timeline.startOffset).toBe(-120);
    expect(timeline.ticks[0].label).toBe("3p");
  });

  it("widens forwards for a sitting running past the close", () => {
    // 22:30 + 2h runs to 00:30, so the window has to reach the small hours to hold the whole bar.
    const timeline = buildTimeline({ ...base, bookings: [booking(1, "22:30", 120)] });

    expect(timeline.endOffset).toBe(480);
    expect(timeline.ticks.at(-1)?.label).toBe("12a");
  });

  it("spans the night for an overnight service rather than collapsing to one hour", () => {
    const timeline = buildTimeline({
      ...base,
      openTime: "18:00",
      closeTime: "02:00",
      bookings: [],
    });

    expect(timeline.ticks.map((t) => t.label)).toEqual([
      "6p",
      "7p",
      "8p",
      "9p",
      "10p",
      "11p",
      "12a",
      "1a",
    ]);
  });

  it("draws the whole day when the open and close times match", () => {
    const timeline = buildTimeline({
      ...base,
      openTime: "00:00",
      closeTime: "00:00",
      bookings: [],
    });

    expect(timeline.ticks).toHaveLength(24);
  });

  it("snaps a half-hour open time outwards, so no minute of service falls off the left", () => {
    const timeline = buildTimeline({
      ...base,
      openTime: "17:30",
      closeTime: "23:00",
      bookings: [],
    });

    expect(timeline.ticks[0].label).toBe("5p");
    expect(timeline.startOffset).toBe(-30);
  });
});

describe("nowOffset", () => {
  const timeline = buildTimeline({ ...base, bookings: [] });

  it("places now inside the service window", () => {
    expect(nowOffset(timeline, "17:00", 19 * 60)).toBe(120);
  });

  it("returns null off the drawn window, so no marker is drawn on a closed hour", () => {
    expect(nowOffset(timeline, "17:00", 9 * 60)).toBeNull();
  });

  it("returns null when the caller has no local time, which is any day but today", () => {
    expect(nowOffset(timeline, "17:00", null)).toBeNull();
  });

  it("places a pre-opening now to the left of the window it widened", () => {
    const widened = buildTimeline({ ...base, bookings: [booking(1, "15:00", 60)] });

    expect(nowOffset(widened, "17:00", 16 * 60)).toBe(-60);
  });
});

describe("formatRemaining", () => {
  it("reads in minutes under the hour", () => {
    expect(formatRemaining(45)).toBe("45m left");
  });

  it("reads in whole hours on the hour", () => {
    expect(formatRemaining(120)).toBe("2h left");
  });

  it("reads in hours and minutes in between", () => {
    expect(formatRemaining(90)).toBe("1h 30m left");
  });

  it("says the sitting is ending rather than counting past zero", () => {
    expect(formatRemaining(0)).toBe("ending");
    expect(formatRemaining(-10)).toBe("ending");
  });
});

describe("formatClockMinutes", () => {
  it("reads midnight as 12a rather than 0a", () => {
    expect(formatClockMinutes(0)).toBe("12:00a");
  });

  it("reads noon as 12p rather than 0p", () => {
    expect(formatClockMinutes(12 * 60)).toBe("12:00p");
  });

  it("reads an evening sitting on the 12-hour clock", () => {
    expect(formatClockMinutes(18 * 60 + 30)).toBe("6:30p");
  });

  it("wraps a past-midnight offset back onto the clock", () => {
    expect(formatClockMinutes(25 * 60)).toBe("1:00a");
  });
});
