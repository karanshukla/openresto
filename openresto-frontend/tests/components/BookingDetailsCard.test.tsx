import React from "react";
import { render, screen, act } from "@testing-library/react-native";
import i18n from "@/i18n";
import { BookingDetailsCard } from "@/components/admin/bookings/BookingDetailsCard";

function flattenStyle(style: unknown): Record<string, unknown>[] {
  return ([] as unknown[]).concat(style).flat(Infinity).filter(Boolean) as Record<
    string,
    unknown
  >[];
}

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

  it("shows None when there are no special requests", () => {
    render(
      <BookingDetailsCard {...props} booking={{ ...mockBooking, specialRequests: undefined }} />
    );
    expect(screen.getByText("None")).toBeTruthy();
  });

  it("handles different time duration and party label", () => {
    render(
      <BookingDetailsCard
        {...props}
        booking={{
          ...mockBooking,
          seats: 1,
          endTime: "2026-10-10T14:30:00Z",
        }}
      />
    );
    expect(screen.getByText("1 guest")).toBeTruthy();
    expect(screen.getByText(/150 min/)).toBeTruthy(); // 12:00 to 14:30 is 150 mins
  });
});

/**
 * The cancelled-row highlight used to compare the rendered English label ("Status") to
 * decide which row to redden. Once the label is translated that comparison silently stops
 * matching in every non-English locale, so the row-identity check now runs off a `key`
 * field instead of the localized text.
 * @see [BookingDetailsCard.test.tsx](BookingDetailsCard.test.tsx) — this file.
 */
describe("label/value split — the Status row highlight is keyed, not text-matched", () => {
  const cancelledBooking = {
    id: 1,
    bookingRef: "REF123",
    customerEmail: "guest@example.com",
    date: "2026-10-10T12:00:00Z",
    seats: 2,
    restaurantName: "Test Resto",
    sectionName: "Main",
    tableName: "Table 1",
    specialRequests: "Window seat",
    isCancelled: true,
  };
  const props = {
    booking: cancelledBooking,
    borderColor: "gray",
    mutedColor: "lightgray",
    cardColor: "white",
  };

  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage("en");
    });
  });

  it("highlights the cancelled status value in English", () => {
    render(<BookingDetailsCard {...props} />);
    const value = screen.getByText("CANCELLED");
    const flattened = flattenStyle(value.props.style);
    expect(flattened.some((s) => s.color === "#dc2626")).toBe(true);
  });

  it("still highlights the cancelled status value once the label text is French, not English", async () => {
    await act(async () => {
      await i18n.changeLanguage("fr");
    });
    render(<BookingDetailsCard {...props} />);
    // The French label ("Statut") no longer reads "Status" — proof the highlight isn't
    // driven by a literal-string comparison against the rendered label.
    expect(screen.queryByText("Status")).toBeNull();
    const value = screen.getByText("ANNULÉ");
    const flattened = flattenStyle(value.props.style);
    expect(flattened.some((s) => s.color === "#dc2626")).toBe(true);
  });
});
