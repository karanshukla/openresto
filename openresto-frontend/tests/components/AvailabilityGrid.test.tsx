import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { AvailabilityGrid } from "@/components/admin/bookings/AvailabilityGrid";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));

jest.mock("@/utils/colors", () => ({
  hexToRgba: (_h: string, _a: number) => "rgba(0,0,0,0.1)",
}));

describe("AvailabilityGrid", () => {
  const mockSections = [
    {
      id: 1,
      name: "Main",
      tables: [{ id: 101, name: "Table 1", seats: 4, sectionId: 1 }],
    },
  ];

  const mockBookings = [
    {
      id: 10,
      tableId: 101,
      date: new Date(new Date().setHours(12, 0, 0, 0)).toISOString(), // 12:00 PM
      seats: 2,
      customerEmail: "booked@test.com",
    },
  ];

  const props = {
    sections: mockSections as any,
    bookings: mockBookings as any,
    isDark: false,
    onBookingPress: jest.fn(),
  };

  it("renders empty state when no sections", () => {
    render(<AvailabilityGrid {...props} sections={[]} />);
    expect(screen.getByText(/No tables found/)).toBeTruthy();
  });

  it("renders grid with tables and slots", () => {
    render(<AvailabilityGrid {...props} />);
    expect(screen.getByText("MAIN")).toBeTruthy();
    expect(screen.getByText("Table 1")).toBeTruthy();
    expect(screen.getByText("12p")).toBeTruthy();
  });

  it("renders booking in cell and handles press", () => {
    render(<AvailabilityGrid {...props} />);
    // The cell for 12p should have "booked"
    const bookingCell = screen.getByText("booked");
    expect(bookingCell).toBeTruthy();

    fireEvent.press(bookingCell);
    expect(props.onBookingPress).toHaveBeenCalledWith(mockBookings[0]);
  });

  it("renders correctly in dark mode", () => {
    render(<AvailabilityGrid {...props} isDark={true} />);
    expect(screen.getByText("Table 1")).toBeTruthy();
  });

  // Narrowing a location's opening hours does not move the bookings already taken under the
  // old ones (#359). The timetable is where staff would look for them, so it has to widen to
  // cover a sitting the current window no longer contains.
  it("keeps a booking that now falls outside the opening hours visible", () => {
    render(<AvailabilityGrid {...props} openTime="17:00" closeTime="23:00" timezone="UTC" />);

    expect(screen.getByText("12p")).toBeTruthy();
    expect(screen.getByText("booked")).toBeTruthy();
  });

  it("does not draw a column for an hour with no booking in it", () => {
    render(<AvailabilityGrid {...props} openTime="17:00" closeTime="23:00" timezone="UTC" />);

    expect(screen.queryByText("1p")).toBeNull();
  });

  it("spans the night for an overnight service rather than collapsing to one column", () => {
    render(
      <AvailabilityGrid
        {...props}
        bookings={[]}
        openTime="18:00"
        closeTime="02:00"
        timezone="UTC"
      />
    );

    expect(screen.getByText("6p")).toBeTruthy();
    expect(screen.getByText("11p")).toBeTruthy();
    expect(screen.getByText("12a")).toBeTruthy();
    expect(screen.getByText("1a")).toBeTruthy();
    expect(screen.queryByText("2a")).toBeNull();
  });

  it("draws the full day when opening and closing time match", () => {
    render(
      <AvailabilityGrid
        {...props}
        bookings={[]}
        openTime="00:00"
        closeTime="00:00"
        timezone="UTC"
      />
    );

    expect(screen.getByText("12a")).toBeTruthy();
    expect(screen.getByText("11p")).toBeTruthy();
  });
});
