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

describe("CalendarActions", () => {
  it("renders full variant by default", () => {
    render(<CalendarActions {...baseProps} />);
    expect(screen.getByText("Google Calendar")).toBeTruthy();
    expect(screen.getByText("Outlook Calendar")).toBeTruthy();
    expect(screen.getByText("Download .ics")).toBeTruthy();
  });

  it("renders compact variant", () => {
    render(<CalendarActions {...baseProps} variant="compact" />);
    expect(screen.getByText("Google")).toBeTruthy();
    expect(screen.getByText("Outlook")).toBeTruthy();
    expect(screen.getByText(".ics")).toBeTruthy();
  });

  it("shows ADD TO CALENDAR header in compact variant", () => {
    render(<CalendarActions {...baseProps} variant="compact" />);
    expect(screen.getByText("ADD TO CALENDAR")).toBeTruthy();
  });

  it("shows ADD TO CALENDAR header in full variant", () => {
    render(<CalendarActions {...baseProps} />);
    expect(screen.getByText("ADD TO CALENDAR")).toBeTruthy();
  });

  it("shows sub-label only for ics in full variant", () => {
    render(<CalendarActions {...baseProps} />);
    expect(screen.queryByText("Opens in a new tab")).toBeNull();
    expect(screen.getByText("Apple Calendar, Thunderbird, etc.")).toBeTruthy();
  });

  it("calls downloadIcs when .ics button is pressed in compact variant", () => {
    const downloadIcs = jest.fn();
    const { buildCalendarUrls } = require("@/utils/calendar");
    buildCalendarUrls.mockReturnValue({
      googleUrl: "https://calendar.google.com/test",
      outlookUrl: "https://outlook.com/test",
      downloadIcs,
    });
    render(<CalendarActions {...baseProps} variant="compact" />);
    fireEvent.press(screen.getByText(".ics"));
    expect(downloadIcs).toHaveBeenCalled();
  });

  it("calls downloadIcs when Download .ics is pressed in full variant", () => {
    const downloadIcs = jest.fn();
    const { buildCalendarUrls } = require("@/utils/calendar");
    buildCalendarUrls.mockReturnValue({
      googleUrl: "https://calendar.google.com/test",
      outlookUrl: "https://outlook.com/test",
      downloadIcs,
    });
    render(<CalendarActions {...baseProps} />);
    fireEvent.press(screen.getByText("Download .ics"));
    expect(downloadIcs).toHaveBeenCalled();
  });

  it("renders with specialRequests prop", () => {
    render(<CalendarActions {...baseProps} specialRequests="window seat" />);
    expect(screen.getByText("Google Calendar")).toBeTruthy();
  });

  it("renders compact variant in dark mode", () => {
    (useColorScheme as jest.Mock).mockReturnValueOnce("dark");
    render(<CalendarActions {...baseProps} variant="compact" />);
    expect(screen.getByText("Google")).toBeTruthy();
  });

  it("renders full variant in dark mode", () => {
    (useColorScheme as jest.Mock).mockReturnValueOnce("dark");
    render(<CalendarActions {...baseProps} />);
    expect(screen.getByText("Google Calendar")).toBeTruthy();
  });
});
