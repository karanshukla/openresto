/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import CalendarActions from "@/components/booking/CalendarActions";
import { buildCalendarUrls } from "@/utils/calendar";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));
jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));
jest.mock("@/utils/calendar", () => ({
  buildCalendarUrls: jest.fn(() => ({
    googleUrl: "google-url",
    outlookUrl: "outlook-url",
    downloadIcs: jest.fn(),
  })),
}));

describe("CalendarActions", () => {
  const props = {
    bookingRef: "REF123",
    date: "2026-10-10",
    seats: 2,
    restaurantName: "Resto",
    restaurantAddress: "Addr",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete (window as any).open;
    (window as any).open = jest.fn();
  });

  it("renders compact variant and handles clicks", () => {
    const { downloadIcs } = (buildCalendarUrls as jest.Mock).mock.results[0]?.value || { downloadIcs: jest.fn() };
    render(<CalendarActions {...props} variant="compact" />);
    
    expect(screen.getByText("ADD TO CALENDAR")).toBeTruthy();
    expect(screen.getByText("Google")).toBeTruthy();

    fireEvent.press(screen.getByText("Google"));
    expect(window.open).toHaveBeenCalledWith("google-url", "_blank");

    fireEvent.press(screen.getByText("Outlook"));
    expect(window.open).toHaveBeenCalledWith("outlook-url", "_blank");

    fireEvent.press(screen.getByText(".ics"));
    // buildCalendarUrls returns a new object each time or we can check the call
    expect(buildCalendarUrls).toHaveBeenCalled();
  });

  it("renders full variant", () => {
    render(<CalendarActions {...props} variant="full" />);
    expect(screen.getByText("Google Calendar")).toBeTruthy();
    expect(screen.getByText("Outlook Calendar")).toBeTruthy();
    expect(screen.getByText("Download .ics")).toBeTruthy();
  });
});
