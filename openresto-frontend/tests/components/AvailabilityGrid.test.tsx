import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { AvailabilityGrid } from "@/components/admin/bookings/AvailabilityGrid";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
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
});
