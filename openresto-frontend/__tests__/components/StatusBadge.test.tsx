import React from "react";
import { render, screen } from "@testing-library/react-native";
import { StatusBadge, getStatus } from "@/components/admin/bookings/StatusBadge";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

describe("getStatus", () => {
  it("returns 'Completed' for bookings more than 90 minutes ago", () => {
    const date = new Date(Date.now() - 100 * 60 * 1000).toISOString();
    expect(getStatus(date)).toEqual({ label: "Completed", variant: "completed" });
  });

  it("returns 'Seated' for bookings 15-90 minutes ago", () => {
    const date = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    expect(getStatus(date)).toEqual({ label: "Seated", variant: "seated" });
  });

  it("returns 'Arrived' for bookings within 5 minutes of now", () => {
    const date = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    expect(getStatus(date)).toEqual({ label: "Arrived", variant: "arrived" });
  });

  it("returns 'Upcoming' for bookings 5-60 minutes in the future", () => {
    const date = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    expect(getStatus(date)).toEqual({ label: "Upcoming", variant: "upcoming" });
  });

  it("returns 'Scheduled' for bookings more than 60 minutes in the future", () => {
    const date = new Date(Date.now() + 120 * 60 * 1000).toISOString();
    expect(getStatus(date)).toEqual({ label: "Scheduled", variant: "scheduled" });
  });
});

describe("StatusBadge", () => {
  it("renders all variants in light mode", () => {
    const variants: any[] = [
      { d: -100, l: "Completed" },
      { d: -30, l: "Seated" },
      { d: 0, l: "Arrived" },
      { d: 30, l: "Upcoming" },
      { d: 120, l: "Scheduled" },
    ];
    variants.forEach((v) => {
      const { unmount } = render(
        <StatusBadge date={new Date(Date.now() + v.d * 60 * 1000).toISOString()} isDark={false} />
      );
      expect(screen.getByText(v.l)).toBeTruthy();
      unmount();
    });
  });

  it("renders all variants in dark mode (triggering fallbacks)", () => {
    const variants: any[] = [
      { d: -100, l: "Completed" },
      { d: -30, l: "Seated" },
      { d: 0, l: "Arrived" },
      { d: 30, l: "Upcoming" },
      { d: 120, l: "Scheduled" },
    ];
    variants.forEach((v) => {
      const { unmount } = render(
        <StatusBadge date={new Date(Date.now() + v.d * 60 * 1000).toISOString()} isDark={true} />
      );
      expect(screen.getByText(v.l)).toBeTruthy();
      unmount();
    });
  });
});
