import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react-native";
import { ServiceView } from "@/components/admin/bookings/ServiceView";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

jest.mock("@/utils/colors", () => ({
  hexToRgba: (_h: string, _a: number) => "rgba(0,0,0,0.1)",
}));

const DAY = "2026-08-23";

function booking(
  id: number,
  hhmm: string,
  minutes: number,
  overrides: Partial<Record<string, unknown>> = {}
) {
  const date = `${DAY}T${hhmm}:00.000Z`;
  return {
    id,
    tableId: 101,
    tableGroupId: null,
    date,
    endTime: new Date(new Date(date).getTime() + minutes * 60000).toISOString(),
    seats: 2,
    customerEmail: "booked@test.com",
    ...overrides,
  };
}

const sections = [
  {
    id: 1,
    name: "Main",
    tables: [
      { id: 101, name: "Table 1", seats: 4 },
      { id: 102, name: "Table 2", seats: 2 },
    ],
  },
];

const props = {
  sections: sections as never,
  bookings: [booking(10, "18:00", 90)] as never,
  isDark: false,
  onBookingPress: jest.fn(),
  openTime: "17:00",
  closeTime: "23:00",
  timezone: "UTC",
  // Never the location's today, so the floor opens on the first sitting and the clock cannot
  // walk these assertions off their times mid-run.
  gridDateIso: DAY,
};

/**
 * A 6pm sitting on Table 1 plus one on Table 2 at `hhmm`. The floor opens on the earliest sitting,
 * so the anchor fixes the observed moment at 6pm and lets Table 2 be read before its party arrives.
 */
function anchoredAt(hhmm: string) {
  return [booking(10, "18:00", 90), booking(11, hhmm, 90, { tableId: 102 })] as never;
}

describe("ServiceView", () => {
  beforeEach(() => jest.clearAllMocks());

  it("says so plainly when the location has no tables to lay out", () => {
    render(<ServiceView {...props} sections={[] as never} />);
    expect(screen.getByText(/No tables found/)).toBeTruthy();
  });

  it("lists every table in the section, booked or not", () => {
    render(<ServiceView {...props} />);
    expect(screen.getByText("MAIN")).toBeTruthy();
    expect(screen.getByText("Table 1")).toBeTruthy();
    expect(screen.getByText("Table 2")).toBeTruthy();
  });

  it("opens on the first sitting of a day that is not today, so the floor is not blank", () => {
    render(<ServiceView {...props} />);
    expect(screen.getByTestId("service-scrub-clock")).toHaveTextContent("6:00p");
  });

  it("names the guest, their covers and what is left of their sitting", () => {
    render(<ServiceView {...props} />);

    expect(screen.getByText("booked")).toBeTruthy();
    expect(screen.getByText("6:00p – 7:30p")).toBeTruthy();
    expect(screen.getByText("1h 30m left")).toBeTruthy();
  });

  it("prefers the guest's name over their email when there is one", () => {
    render(
      <ServiceView
        {...props}
        bookings={[booking(10, "18:00", 90, { customerName: "Patel" })] as never}
      />
    );
    expect(screen.getByText("Patel")).toBeTruthy();
  });

  it("marks an occupied table seated and an unbooked one free", () => {
    render(<ServiceView {...props} />);

    expect(within(screen.getByTestId("service-unit-table:101")).getByText(/Seated/)).toBeTruthy();
    expect(within(screen.getByTestId("service-unit-table:102")).getByText(/Free/)).toBeTruthy();
  });

  it("counts the covers actually seated at the shown moment", () => {
    render(
      <ServiceView
        {...props}
        bookings={
          [
            booking(10, "18:00", 90, { seats: 4 }),
            booking(11, "21:00", 90, { seats: 6, tableId: 102 }),
          ] as never
        }
      />
    );
    expect(within(screen.getByTestId("service-covers")).getByText("4 covers")).toBeTruthy();
  });

  it("opens the booking when its table is pressed", () => {
    render(<ServiceView {...props} />);

    fireEvent.press(screen.getByTestId("service-unit-table:101"));

    expect(props.onBookingPress).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }));
  });

  it("opens the sitting still to come when a free table is pressed", () => {
    render(<ServiceView {...props} bookings={anchoredAt("20:00")} />);

    fireEvent.press(screen.getByTestId("service-unit-table:102"));

    expect(props.onBookingPress).toHaveBeenCalledWith(expect.objectContaining({ id: 11 }));
  });

  it("says nothing else is booked on a table with no sittings left", () => {
    render(<ServiceView {...props} />);
    expect(
      within(screen.getByTestId("service-unit-table:102")).getByText(/Nothing else today/)
    ).toBeTruthy();
  });

  it("announces the next sitting and how long the table stays free", () => {
    render(<ServiceView {...props} bookings={anchoredAt("20:00")} />);
    expect(
      within(screen.getByTestId("service-unit-table:102")).getByText(/Next 8:00p/)
    ).toBeTruthy();
  });

  // A table with a party due imminently cannot be offered to a walk-in, so it is not "free".
  it("marks a table turning over when its next sitting is inside the turnaround", () => {
    render(<ServiceView {...props} bookings={anchoredAt("18:30")} />);
    expect(within(screen.getByTestId("service-unit-table:102")).getByText(/Turning/)).toBeTruthy();
  });

  it("marks the same table free when that sitting is beyond the turnaround", () => {
    render(<ServiceView {...props} bookings={anchoredAt("18:45")} />);
    expect(within(screen.getByTestId("service-unit-table:102")).getByText(/Free/)).toBeTruthy();
  });

  it("steps the shown time forward and back in quarter hours", () => {
    render(<ServiceView {...props} />);

    fireEvent.press(screen.getByTestId("service-scrub-forward"));
    expect(screen.getByTestId("service-scrub-clock")).toHaveTextContent("6:15p");

    fireEvent.press(screen.getByTestId("service-scrub-back"));
    expect(screen.getByTestId("service-scrub-clock")).toHaveTextContent("6:00p");
  });

  it("re-reads the floor at the scrubbed time, not the time it opened on", () => {
    render(<ServiceView {...props} bookings={[booking(10, "18:00", 30)] as never} />);

    expect(within(screen.getByTestId("service-unit-table:101")).getByText(/Seated/)).toBeTruthy();

    fireEvent.press(screen.getByTestId("service-scrub-forward"));
    fireEvent.press(screen.getByTestId("service-scrub-forward"));
    fireEvent.press(screen.getByTestId("service-scrub-forward"));

    expect(within(screen.getByTestId("service-unit-table:101")).getByText(/Free/)).toBeTruthy();
  });

  it("holds the scrubbed time at the edge of the day rather than running off it", () => {
    render(<ServiceView {...props} />);

    for (let i = 0; i < 40; i++) fireEvent.press(screen.getByTestId("service-scrub-back"));

    expect(screen.getByTestId("service-scrub-clock")).toHaveTextContent("5:00p");
  });

  it("offers no jump back to now on a day that has no now on it", () => {
    render(<ServiceView {...props} />);
    expect(screen.queryByTestId("service-scrub-now")).toBeNull();
  });

  it("gives a combinable group its own place on the floor beside its member tables", () => {
    render(
      <ServiceView
        {...props}
        groups={[{ id: 5, name: "Long table", combinedSeats: 10, members: [] }] as never}
        bookings={[booking(10, "18:00", 90, { tableId: null, tableGroupId: 5 })] as never}
      />
    );

    expect(within(screen.getByTestId("service-unit-group:5")).getByText(/Seated/)).toBeTruthy();
    expect(within(screen.getByTestId("service-unit-table:101")).getByText(/Free/)).toBeTruthy();
  });

  it("says so on a day with nothing booked at all", () => {
    render(<ServiceView {...props} bookings={[] as never} dateLabel="Sun 23 Aug" />);
    expect(screen.getByText("No bookings on Sun 23 Aug")).toBeTruthy();
  });

  it("falls back to a generic name for a guest with neither name nor email", () => {
    render(
      <ServiceView
        {...props}
        bookings={[booking(10, "18:00", 90, { customerName: null, customerEmail: null })] as never}
      />
    );
    expect(within(screen.getByTestId("service-unit-table:101")).getByText("Guest")).toBeTruthy();
  });

  it("names no day in the empty state when it was not given one", () => {
    render(<ServiceView {...props} bookings={[] as never} />);
    expect(screen.getByText("No bookings on this day")).toBeTruthy();
  });

  it("falls back to its own service hours when the location supplies none", () => {
    render(
      <ServiceView
        sections={props.sections}
        bookings={[] as never}
        isDark={false}
        onBookingPress={jest.fn()}
        gridDateIso={DAY}
      />
    );
    expect(screen.getByText("Table 1")).toBeTruthy();
  });
});

describe("ServiceView on the location's today", () => {
  /** Today in the location's zone, which is the only day the floor has a "now" to follow. */
  const today = new Date().toISOString().slice(0, 10);

  function bookingToday(id: number, minutesFromNow: number, minutes: number, tableId = 101) {
    const start = new Date(Date.now() + minutesFromNow * 60000);
    return {
      id,
      tableId,
      tableGroupId: null,
      date: start.toISOString(),
      endTime: new Date(start.getTime() + minutes * 60000).toISOString(),
      seats: 2,
      customerEmail: "booked@test.com",
    };
  }

  const liveProps = {
    ...props,
    gridDateIso: today,
    openTime: "00:00",
    closeTime: "23:59",
    bookings: [bookingToday(20, -15, 90)] as never,
  };

  beforeEach(() => jest.clearAllMocks());

  it("follows the clock, so a party seated a quarter hour ago reads as seated", () => {
    render(<ServiceView {...liveProps} />);
    expect(within(screen.getByTestId("service-unit-table:101")).getByText(/Seated/)).toBeTruthy();
  });

  it("offers a way back to now once the floor has been scrubbed off it", () => {
    render(<ServiceView {...liveProps} />);
    const clock = screen.getByTestId("service-scrub-clock").props.children;

    fireEvent.press(screen.getByTestId("service-scrub-forward"));
    expect(screen.getByTestId("service-scrub-clock").props.children).not.toBe(clock);

    fireEvent.press(screen.getByTestId("service-scrub-now"));
    expect(screen.getByTestId("service-scrub-clock").props.children).toBe(clock);
  });

  it("maps a position on the track to a time, so the far ends are different moments", () => {
    render(<ServiceView {...liveProps} />);
    const track = screen.getByTestId("service-scrub-track");
    const clock = () => screen.getByTestId("service-scrub-clock").props.children;

    fireEvent(track, "layout", { nativeEvent: { layout: { width: 240 } } });

    fireEvent(track, "responderGrant", { nativeEvent: { locationX: 0 } });
    const atStart = clock();

    fireEvent(track, "responderMove", { nativeEvent: { locationX: 240 } });
    expect(clock()).not.toBe(atStart);

    fireEvent(track, "responderMove", { nativeEvent: { locationX: 0 } });
    expect(clock()).toBe(atStart);
  });

  it("clamps a drag past either end of the track to the day it draws", () => {
    render(<ServiceView {...liveProps} />);
    const track = screen.getByTestId("service-scrub-track");
    const clock = () => screen.getByTestId("service-scrub-clock").props.children;

    fireEvent(track, "layout", { nativeEvent: { layout: { width: 240 } } });

    fireEvent(track, "responderGrant", { nativeEvent: { locationX: 0 } });
    const atStart = clock();
    fireEvent(track, "responderMove", { nativeEvent: { locationX: -400 } });

    expect(clock()).toBe(atStart);
  });

  it("ignores a drag before the track has been measured", () => {
    render(<ServiceView {...liveProps} />);
    const before = screen.getByTestId("service-scrub-clock").props.children;

    fireEvent(screen.getByTestId("service-scrub-track"), "responderGrant", {
      nativeEvent: { locationX: 100 },
    });

    expect(screen.getByTestId("service-scrub-clock").props.children).toBe(before);
  });
});
