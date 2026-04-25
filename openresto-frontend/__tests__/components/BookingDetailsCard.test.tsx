import React from "react";
import { render, screen } from "@testing-library/react-native";
import { BookingDetailsCard } from "@/components/admin/bookings/BookingDetailsCard";

describe("BookingDetailsCard", () => {
  const mockBooking = {
    id: 1,
    bookingRef: "REF123",
    customerEmail: "guest@example.com",
    date: "2026-10-10T12:00:00Z",
    seats: 2,
    restaurantName: "Test Resto",
    sectionName: "Main",
    tableName: "Table 1",
    specialRequests: "Window seat",
    isCancelled: false,
  };

  const props = {
    booking: mockBooking,
    borderColor: "gray",
    mutedColor: "lightgray",
    cardColor: "white",
  };

  it("renders booking details correctly", () => {
    render(<BookingDetailsCard {...props} />);
    expect(screen.getByText("REF123")).toBeTruthy();
    expect(screen.getByText("guest@example.com")).toBeTruthy();
    expect(screen.getByText("2 guests")).toBeTruthy();
    expect(screen.getByText("Test Resto")).toBeTruthy();
    expect(screen.getByText("Window seat")).toBeTruthy();
  });

  it("renders fallback ref and cancelled status", () => {
    render(
      <BookingDetailsCard
        {...props}
        booking={{ ...mockBooking, bookingRef: undefined, isCancelled: true }}
      />
    );
    expect(screen.getByText("#1")).toBeTruthy();
    expect(screen.getByText("CANCELLED")).toBeTruthy();
  });

  it("handles different time duration and party label", () => {
    render(
        <BookingDetailsCard
          {...props}
          booking={{ 
            ...mockBooking, 
            seats: 1, 
            endTime: "2026-10-10T14:30:00Z" 
          }}
        />
      );
      expect(screen.getByText("1 guest")).toBeTruthy();
      expect(screen.getByText(/150 min/)).toBeTruthy(); // 12:00 to 14:30 is 150 mins
  });
});
