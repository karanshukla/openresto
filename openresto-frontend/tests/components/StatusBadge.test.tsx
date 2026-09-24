import React from "react";
import { StyleSheet } from "react-native";
import { render, screen } from "@testing-library/react-native";
import i18n from "@/i18n";
import {
  StatusBadge,
  getStatus,
  isPast,
  statusRankFor,
  statusVariantFor,
  type BadgeBooking,
} from "@/components/admin/bookings/StatusBadge";
import type { BookingDetailDto } from "@/api/admin";

const t = i18n.getFixedT("en");

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

describe("isPast re-export", () => {
  // Full coverage lives in tests/utils/bookingStatus.test.ts, where isPast is actually
  // defined; this just confirms the admin modules that still import it from here work.
  it("re-exports the shared utils/bookingStatus isPast", () => {
    expect(isPast(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())).toBe(true);
    expect(isPast(new Date(Date.now() + 10 * 60 * 1000).toISOString())).toBe(false);
  });
});

const MIN = 60 * 1000;
const at = (minutesFromNow: number) => new Date(Date.now() + minutesFromNow * MIN).toISOString();

/** A Booked sitting starting `start` minutes from now and lasting `length` minutes. */
const booked = (start: number, length = 60): BadgeBooking => ({
  date: at(start),
  endTime: at(start + length),
  status: "Booked",
});

describe("getStatus for a booking still Booked", () => {
  it("is Scheduled more than an hour out", () => {
    expect(getStatus(booked(120), t)).toEqual({ label: "Scheduled", variant: "scheduled" });
  });

  it("is Upcoming inside the hour before its start", () => {
    expect(getStatus(booked(30), t)).toEqual({ label: "Upcoming", variant: "upcoming" });
  });

  it("is Due once its start has passed and nobody has checked the party in", () => {
    expect(getStatus(booked(-1), t)).toEqual({ label: "Due", variant: "due" });
  });

  it("stays Due until its own end, however long the sitting", () => {
    expect(getStatus(booked(-100, 120), t).variant).toBe("due");
  });

  it("is Unmarked once its own end has passed", () => {
    expect(getStatus(booked(-121, 120), t)).toEqual({ label: "Unmarked", variant: "unmarked" });
  });

  it("falls back to an hour-long sitting without an end", () => {
    expect(getStatus({ date: at(-50) }, t).variant).toBe("due");
    expect(getStatus({ date: at(-61) }, t).variant).toBe("unmarked");
  });
});

describe("recorded status", () => {
  it("overrides the clock once staff record one", () => {
    expect(getStatus({ ...booked(30), status: "Arrived" }, t)).toEqual({
      label: "Arrived",
      variant: "arrived",
    });
    expect(getStatus({ ...booked(-30), status: "Seated" }, t).variant).toBe("seated");
    expect(getStatus({ ...booked(-200), status: "Finished" }, t).variant).toBe("finished");
    expect(getStatus({ ...booked(-10), status: "NoShow" }, t)).toEqual({
      label: "No-show",
      variant: "noShow",
    });
  });
});

describe("label/value split — variant stays untranslated so rank/style lookups don't break", () => {
  it("resolves a localized label while the variant stays the same", () => {
    const frT = i18n.getFixedT("fr");
    expect(getStatus(booked(-121), frT).variant).toBe("unmarked");
    expect(getStatus(booked(-121), frT).label).not.toBe(getStatus(booked(-121), t).label);
    expect(statusVariantFor(booked(-121))).toBe("unmarked");
  });
});

describe("statusRankFor", () => {
  const mk = (b: BadgeBooking, isCancelled = false) =>
    ({ id: 1, restaurantId: 1, isCancelled, ...b }) as unknown as BookingDetailDto;

  it("ranks cancelled bookings lowest (0)", () => {
    expect(statusRankFor(mk(booked(120), true))).toBe(0);
  });

  it("puts a party that is due above the floor, then upcoming, scheduled and past", () => {
    const due = statusRankFor(mk(booked(-5)));
    const seated = statusRankFor(mk({ ...booked(-30), status: "Seated" }));
    const upcoming = statusRankFor(mk(booked(30)));
    const scheduled = statusRankFor(mk(booked(120)));
    const unmarked = statusRankFor(mk(booked(-200)));
    expect(due).toBeGreaterThan(seated);
    expect(seated).toBeGreaterThan(upcoming);
    expect(upcoming).toBeGreaterThan(scheduled);
    expect(scheduled).toBeGreaterThan(unmarked);
  });

  it("ranks a finished sitting with the unmarked past ones", () => {
    expect(statusRankFor(mk({ ...booked(-30), status: "Finished" }))).toBe(
      statusRankFor(mk(booked(-200)))
    );
  });
});

describe("StatusBadge", () => {
  const cases: { booking: BadgeBooking; label: string }[] = [
    { booking: booked(-200), label: "Unmarked" },
    { booking: booked(-5), label: "Due" },
    { booking: booked(30), label: "Upcoming" },
    { booking: booked(120), label: "Scheduled" },
    { booking: { ...booked(-5), status: "Arrived" }, label: "Arrived" },
    { booking: { ...booked(-30), status: "Seated" }, label: "Seated" },
    { booking: { ...booked(-200), status: "Finished" }, label: "Finished" },
    { booking: { ...booked(-10), status: "NoShow" }, label: "No-show" },
  ];

  it.each([false, true])("renders every variant (dark mode: %s)", (isDark) => {
    cases.forEach(({ booking, label }) => {
      const { unmount } = render(<StatusBadge booking={booking} isDark={isDark} />);
      expect(screen.getByText(label)).toBeTruthy();
      unmount();
    });
  });

  // Rose, not the cancelled red, and at 4.5:1 or better on its tint in both themes.
  it.each([
    [false, "#be185d"],
    [true, "#f9a8d4"],
  ])("gives No-show its own colour, apart from cancelled (dark mode: %s)", (isDark, color) => {
    render(<StatusBadge booking={{ ...booked(-10), status: "NoShow" }} isDark={isDark} />);
    expect(screen.getByText("No-show")).toHaveStyle({ color });
  });

  it.each([false, true])(
    "colours Due apart from Upcoming and Unmarked apart from Finished (dark mode: %s)",
    (isDark) => {
      const colorOf = (label: string) =>
        StyleSheet.flatten(screen.getByText(label).props.style).color;
      render(
        <>
          <StatusBadge booking={booked(-10)} isDark={isDark} />
          <StatusBadge booking={booked(30)} isDark={isDark} />
          <StatusBadge booking={booked(-300)} isDark={isDark} />
          <StatusBadge booking={{ ...booked(-300), status: "Finished" }} isDark={isDark} />
        </>
      );
      expect(colorOf("Due")).not.toBe(colorOf("Upcoming"));
      expect(colorOf("Unmarked")).not.toBe(colorOf("Finished"));
    }
  );
});
