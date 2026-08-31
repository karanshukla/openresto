import { buildTimeline, buildUnitRows, clockMinutesAt } from "@/utils/bookingTimeline";
import {
  buildServiceFloor,
  splitDuration,
  summarise,
  TURNAROUND_MINUTES,
  type ServiceSection,
} from "@/utils/serviceView";
import type { BookingDetailDto, SectionWithTables } from "@/api/admin";
import type { TableGroupDto } from "@/api/restaurants";

const DAY = "2026-08-23";

function booking(
  id: number,
  hhmm: string,
  minutes: number,
  unit: { tableId?: number | null; tableGroupId?: number | null } = { tableId: 1 },
  seats = 2
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
    endTime: new Date(new Date(date).getTime() + minutes * 60000).toISOString(),
    customerEmail: `guest${id}@test.com`,
    customerName: `Guest ${id}`,
    seats,
  };
}

const sections: SectionWithTables[] = [
  {
    id: 1,
    name: "Main",
    tables: [
      { id: 1, name: "T1", seats: 4 },
      { id: 2, name: "T2", seats: 2 },
    ],
  },
];

const OPEN = "17:00";

/** T1 + T2 pushed together: the two member tables of the room's one combinable group. */
const LONG_TABLE: TableGroupDto = {
  id: 5,
  name: "Long table",
  combinedSeats: 6,
  members: [
    { id: 1, name: "T1", seats: 4 },
    { id: 2, name: "T2", seats: 2 },
  ],
};

/** The floor as it stands `hhmm` into the day, built the way the screen builds it. */
function floorAt(
  hhmm: string,
  bookings: BookingDetailDto[],
  {
    groups = [],
    includeUnassigned = false,
  }: { groups?: TableGroupDto[]; includeUnassigned?: boolean } = {}
): ServiceSection[] {
  const timeline = buildTimeline({
    openTime: OPEN,
    closeTime: "23:00",
    timezone: "UTC",
    bookings,
    defaultDurationMinutes: 90,
  });
  const [h, m] = hhmm.split(":").map(Number);
  // Offsets are measured from opening, so the observed clock time converts back the same way.
  const at = h * 60 + m - clockMinutesAt(OPEN, 0);
  return buildServiceFloor({
    rows: buildUnitRows(sections, groups, { includeUnassigned }),
    placements: timeline.placements,
    at,
  });
}

const unit = (floor: ServiceSection[], key: string) =>
  floor.flatMap((s) => s.units).find((u) => u.unit.key === key)!;

describe("buildServiceFloor", () => {
  it("reads a table as seated at the minute its sitting starts", () => {
    const floor = floorAt("18:00", [booking(1, "18:00", 90)]);
    expect(unit(floor, "table:1").status).toBe("seated");
  });

  it("reads a table as free at the minute its sitting ends, not still seated", () => {
    const floor = floorAt("19:30", [booking(1, "18:00", 90)]);
    expect(unit(floor, "table:1").status).toBe("free");
  });

  it("counts down what is left of the sitting", () => {
    const floor = floorAt("18:20", [booking(1, "18:00", 90)]);
    expect(unit(floor, "table:1").minutesRemaining).toBe(70);
  });

  it("names the guest sitting there", () => {
    const floor = floorAt("18:20", [booking(1, "18:00", 90)]);
    expect(unit(floor, "table:1").current?.booking.customerName).toBe("Guest 1");
  });

  it("reads a free table with a sitting due within the turnaround as turning over", () => {
    const floor = floorAt("18:00", [
      booking(1, `18:${String(TURNAROUND_MINUTES).padStart(2, "0")}`, 90),
    ]);
    expect(unit(floor, "table:1").status).toBe("turning");
  });

  it("reads a free table whose next sitting is past the turnaround as free", () => {
    const floor = floorAt("18:00", [
      booking(1, `18:${String(TURNAROUND_MINUTES + 1).padStart(2, "0")}`, 90),
    ]);
    expect(unit(floor, "table:1").status).toBe("free");
  });

  it("reads a table with nothing booked as free", () => {
    const floor = floorAt("18:00", [booking(1, "18:00", 90)]);
    expect(unit(floor, "table:2").status).toBe("free");
    expect(unit(floor, "table:2").next).toBeNull();
  });

  it("counts down to the next sitting while the table is still occupied", () => {
    const floor = floorAt("18:00", [booking(1, "18:00", 60), booking(2, "19:30", 60)]);
    const t1 = unit(floor, "table:1");
    expect(t1.status).toBe("seated");
    expect(t1.minutesUntilNext).toBe(90);
  });

  it("places a group booking on its group unit, which carries no table id to match on", () => {
    const floor = floorAt("18:00", [booking(1, "18:00", 90, { tableGroupId: 5 })], {
      groups: [LONG_TABLE],
    });
    expect(unit(floor, "group:5").status).toBe("seated");
  });

  // Pushing T1 and T2 together does not conjure a third table. A party on the group is sitting at
  // both of them, so drawing either as free is the same room read two different ways.
  it("seats the member tables of a group a party is sitting at", () => {
    const floor = floorAt("18:00", [booking(1, "18:00", 90, { tableGroupId: 5 })], {
      groups: [LONG_TABLE],
    });
    expect(unit(floor, "table:1").status).toBe("seated");
    expect(unit(floor, "table:2").current?.booking.id).toBe(1);
  });

  it("seats the group when a party is sitting at one of its member tables", () => {
    const floor = floorAt("18:00", [booking(1, "18:00", 90, { tableId: 1 })], {
      groups: [LONG_TABLE],
    });
    expect(unit(floor, "group:5").status).toBe("seated");
  });

  it("leaves a group and its members free when the sitting is on neither", () => {
    const floor = floorAt("18:00", [], { groups: [LONG_TABLE] });
    expect(unit(floor, "group:5").status).toBe("free");
    expect(unit(floor, "table:1").status).toBe("free");
  });

  it("turns a member table over when its group's next sitting is inside the turnaround", () => {
    const floor = floorAt("18:00", [booking(1, "18:30", 90, { tableGroupId: 5 })], {
      groups: [LONG_TABLE],
    });
    expect(unit(floor, "table:1").status).toBe("turning");
  });

  it("keeps sections in the order the rows came in", () => {
    const floor = floorAt("18:00", []);
    expect(floor.map((s) => s.key)).toEqual(["section:1"]);
  });

  it("picks the sitting covering the moment, not merely the first of the day", () => {
    const floor = floorAt("20:00", [booking(1, "18:00", 60), booking(2, "20:00", 60)]);
    expect(unit(floor, "table:1").current?.booking.id).toBe(2);
  });
});

describe("summarise", () => {
  it("counts covers from the guests actually seated, not the day's bookings", () => {
    const floor = floorAt("18:00", [
      booking(1, "18:00", 90, { tableId: 1 }, 4),
      booking(2, "21:00", 90, { tableId: 2 }, 6),
    ]);
    expect(summarise(floor).covers).toBe(4);
  });

  it("partitions every unit across the three statuses", () => {
    const floor = floorAt("18:00", [booking(1, "18:00", 90)]);
    const summary = summarise(floor);
    expect(summary.seated + summary.turning + summary.free).toBe(2);
  });

  it("counts an empty floor as all free", () => {
    expect(summarise(floorAt("18:00", []))).toEqual({
      seated: 0,
      turning: 0,
      free: 2,
      covers: 0,
    });
  });

  // The room has two tables however many ways they can be pushed together; a group counted as a
  // unit of its own is what let a two-table room report three free.
  it("counts a combinable group as its member tables rather than as seating beside them", () => {
    const summary = summarise(floorAt("18:00", [], { groups: [LONG_TABLE] }));
    expect(summary.free).toBe(2);
    expect(summary.seated + summary.turning + summary.free).toBe(2);
  });

  it("counts a party seated on a group against its member tables, once", () => {
    const summary = summarise(
      floorAt("18:00", [booking(1, "18:00", 90, { tableGroupId: 5 }, 6)], { groups: [LONG_TABLE] })
    );
    expect(summary).toEqual({ seated: 2, turning: 0, free: 0, covers: 6 });
  });

  // The unassigned row stands for a booking whose table was deleted, not for a table.
  it("counts the unassigned row as no table on any of the three statuses", () => {
    const floor = floorAt("18:00", [booking(1, "18:00", 90, { tableId: null }, 3)], {
      includeUnassigned: true,
    });
    const summary = summarise(floor);
    expect(summary.seated + summary.turning + summary.free).toBe(2);
    expect(summary.seated).toBe(0);
  });

  it("still counts the party on the unassigned row among the covers in the room", () => {
    const floor = floorAt("18:00", [booking(1, "18:00", 90, { tableId: null }, 3)], {
      includeUnassigned: true,
    });
    expect(summarise(floor).covers).toBe(3);
  });
});

describe("splitDuration", () => {
  it("leaves no remainder on a whole number of hours", () => {
    expect(splitDuration(120)).toEqual({ hours: 2, minutes: 0 });
  });

  it("splits an hour and a half into both parts", () => {
    expect(splitDuration(90)).toEqual({ hours: 1, minutes: 30 });
  });

  it("reports under an hour as minutes alone", () => {
    expect(splitDuration(45)).toEqual({ hours: 0, minutes: 45 });
  });

  it("floors a span that has already elapsed at zero rather than going negative", () => {
    expect(splitDuration(-10)).toEqual({ hours: 0, minutes: 0 });
  });
});
