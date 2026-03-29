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
  it("renders the correct label for a completed booking", () => {
    const date = new Date(Date.now() - 100 * 60 * 1000).toISOString();
    render(<StatusBadge date={date} isDark={false} />);
    expect(screen.getByText("Completed")).toBeTruthy();
  });

  it("renders the correct label for an upcoming booking", () => {
    const date = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    render(<StatusBadge date={date} isDark={false} />);
    expect(screen.getByText("Upcoming")).toBeTruthy();
  });

  it("renders with dark mode styles", () => {
    const date = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    render(<StatusBadge date={date} isDark={true} />);
    expect(screen.getByText("Upcoming")).toBeTruthy();
  });
});
