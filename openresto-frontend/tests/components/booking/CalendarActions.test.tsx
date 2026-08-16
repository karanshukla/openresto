import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import CalendarActions from "@/components/booking/CalendarActions";
import { useColorScheme } from "@/hooks/use-color-scheme";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: jest.fn(() => "light"),
}));

jest.mock("@/utils/calendar", () => ({
  buildCalendarUrls: jest.fn(() => ({
    googleUrl: "https://calendar.google.com/test",
    outlookUrl: "https://outlook.com/test",
    downloadIcs: jest.fn(),
  })),
}));

const baseProps = {
  bookingRef: "sunny-tarragon",
  date: "2026-06-15T19:00:00Z",
  seats: 2,
  restaurantName: "Test Bistro",
  restaurantAddress: "123 Main St",
};

const withDownloadIcs = (downloadIcs: jest.Mock) => {
  const { buildCalendarUrls } = require("@/utils/calendar");
  buildCalendarUrls.mockReturnValue({
    googleUrl: "https://calendar.google.com/test",
    outlookUrl: "https://outlook.com/test",
    downloadIcs,
  });
};

describe("CalendarActions", () => {
  beforeEach(() => {
    (window as unknown as { open: jest.Mock }).open = jest.fn();
  });

  it("offers all three destinations as named pills under one heading", () => {
    render(<CalendarActions {...baseProps} />);
    expect(screen.getByText("ADD TO CALENDAR")).toBeTruthy();
    expect(screen.getByText("Google")).toBeTruthy();
    expect(screen.getByText("Outlook")).toBeTruthy();
    expect(screen.getByText("Download .ics")).toBeTruthy();
  });

  it("spells out what an .ics is for, for screen readers only", () => {
    render(<CalendarActions {...baseProps} />);
    // The pill stays short; the apps it covers move to the label rather than a sub-line,
    // which is what made these full-width rows in the first place.
    expect(
      screen.getByLabelText("Download .ics for Apple Calendar, Thunderbird and others")
    ).toBeTruthy();
    expect(screen.queryByText("Apple Calendar, Thunderbird, etc.")).toBeNull();
  });

  it("opens the Google and Outlook URLs in a new tab", () => {
    render(<CalendarActions {...baseProps} />);
    fireEvent.press(screen.getByText("Google"));
    expect(window.open).toHaveBeenCalledWith("https://calendar.google.com/test", "_blank");
    fireEvent.press(screen.getByText("Outlook"));
    expect(window.open).toHaveBeenCalledWith("https://outlook.com/test", "_blank");
  });

  it("calls downloadIcs when the .ics pill is pressed", () => {
    const downloadIcs = jest.fn();
    withDownloadIcs(downloadIcs);
    render(<CalendarActions {...baseProps} />);
    fireEvent.press(screen.getByText("Download .ics"));
    expect(downloadIcs).toHaveBeenCalled();
  });

  it("renders with specialRequests prop", () => {
    render(<CalendarActions {...baseProps} specialRequests="window seat" />);
    expect(screen.getByText("Google")).toBeTruthy();
  });

  it("renders in dark mode", () => {
    (useColorScheme as jest.Mock).mockReturnValueOnce("dark");
    render(<CalendarActions {...baseProps} />);
    expect(screen.getByText("Google")).toBeTruthy();
  });
});
