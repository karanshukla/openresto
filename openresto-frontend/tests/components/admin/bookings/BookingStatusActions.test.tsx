import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { BookingStatusActions } from "@/components/admin/bookings/BookingStatusActions";
import type { BookingDetailDto } from "@/api/admin";

jest.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

const booking = (overrides: Partial<BookingDetailDto>): BookingDetailDto => ({
  id: 1,
  restaurantId: 1,
  restaurantName: "R",
  sectionId: 1,
  sectionName: "Main",
  tableId: 1,
  tableName: "T1",
  date: new Date(Date.now() - 10 * 60000).toISOString(),
  customerEmail: "ada@example.com",
  seats: 2,
  status: "Booked",
  nextStatuses: [],
  undoStatus: null,
  ...overrides,
});

const renderActions = (b: BookingDetailDto, onSetStatus = jest.fn()) => {
  render(
    <BookingStatusActions
      booking={b}
      busy={false}
      onSetStatus={onSetStatus}
      borderColor="#ddd"
      mutedColor="#666"
      isDark={false}
    />
  );
  return onSetStatus;
};

describe("BookingStatusActions", () => {
  it("offers only the moves the server listed", () => {
    renderActions(booking({ nextStatuses: ["Arrived", "Seated"] }));

    expect(screen.getByLabelText("Mark as Arrived")).toBeTruthy();
    expect(screen.getByLabelText("Mark as Seated")).toBeTruthy();
    expect(screen.queryByLabelText("Mark as No-show")).toBeNull();
  });

  it("sends the chosen status", () => {
    const onSetStatus = renderActions(booking({ nextStatuses: ["Arrived", "NoShow"] }));

    fireEvent.press(screen.getByLabelText("Mark as No-show"));

    expect(onSetStatus).toHaveBeenCalledWith("NoShow");
  });

  it("names where undo goes back to, and sends that status", () => {
    const onSetStatus = renderActions(
      booking({ status: "Finished", nextStatuses: [], undoStatus: "Seated" })
    );

    fireEvent.press(screen.getByText("Undo, back to Seated"));

    expect(onSetStatus).toHaveBeenCalledWith("Seated");
  });

  it("offers no undo once the window has closed", () => {
    renderActions(booking({ status: "Finished", undoStatus: null }));

    expect(screen.queryByText(/Undo/)).toBeNull();
  });
});
