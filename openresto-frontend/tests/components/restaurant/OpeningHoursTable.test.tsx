/**
 * @jest-environment jsdom
 */
import React from "react";
import { screen } from "@testing-library/react-native";
import OpeningHoursTable from "@/components/restaurant/OpeningHoursTable";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

const baseRestaurant = {
  id: 1,
  name: "Test Bistro",
  openTime: "09:00",
  closeTime: "22:00",
  openHours: [
    { day: 1, open: "09:00", close: "22:00" },
    { day: 2, open: "09:00", close: "22:00" },
    { day: 3, open: "09:00", close: "22:00" },
    { day: 4, open: "09:00", close: "22:00" },
    { day: 5, open: "09:00", close: "23:00" },
    { day: 6, open: "10:00", close: "23:00" },
    { day: 7, open: "10:00", close: "16:00" },
  ],
  openDays: "1,2,3,4,5",
  timezone: "UTC",
  sections: [],
};

describe("OpeningHoursTable", () => {
  it("renders all seven weekday labels", () => {
    renderWithProviders(<OpeningHoursTable restaurant={baseRestaurant as any} />);
    ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].forEach((d) => {
      expect(screen.getByText(new RegExp(d))).toBeTruthy();
    });
  });

  it("shows the hours range for open days", () => {
    renderWithProviders(<OpeningHoursTable restaurant={baseRestaurant as any} />);
    // Friday (day 5) is 09:00–23:00.
    expect(screen.getByText("09:00 – 23:00")).toBeTruthy();
  });

  it("marks days outside openDays as Closed", () => {
    // openDays = "1,2,3,4,5" → Saturday & Sunday are closed.
    renderWithProviders(<OpeningHoursTable restaurant={baseRestaurant as any} />);
    const closed = screen.getAllByText("Closed");
    expect(closed.length).toBe(2);
  });

  it("shows the last booking time under the hours, and only where a guest could book", () => {
    renderWithProviders(
      <OpeningHoursTable
        restaurant={
          {
            ...baseRestaurant,
            openDays: "1,2,3,4,5,6,7",
            walkInDays: "7",
            lastBookingTime: "20:15",
            openHours: baseRestaurant.openHours.map((h) =>
              h.day === 5 ? { ...h, lastBooking: "21:00" } : h
            ),
          } as any
        }
      />
    );
    // Friday carries its own cutoff; the other five bookable days inherit 20:15; Sunday is
    // walk-in only, so it shows none. The hours themselves are unchanged.
    expect(screen.getByText("Last booking 21:00")).toBeTruthy();
    expect(screen.getAllByText("Last booking 20:15")).toHaveLength(5);
    expect(screen.getByText("09:00 – 23:00")).toBeTruthy();
  });

  it("shows no last booking line when none is set", () => {
    renderWithProviders(<OpeningHoursTable restaurant={baseRestaurant as any} />);
    expect(screen.queryByText(/Last booking/)).toBeNull();
  });

  it("annotates walk-in-only days with a Walk-in badge", () => {
    renderWithProviders(
      <OpeningHoursTable
        restaurant={{ ...baseRestaurant, walkInDays: "6,7", openDays: "1,2,3,4,5,6,7" } as any}
      />
    );
    // Saturday & Sunday are open + walk-in-only → two Walk-in badges.
    const walkIn = screen.getAllByText("Walk-in");
    expect(walkIn.length).toBe(2);
  });
});
