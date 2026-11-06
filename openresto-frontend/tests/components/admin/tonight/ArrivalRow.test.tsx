import React from "react";
import { fireEvent, screen } from "@testing-library/react-native";
import { ArrivalRow } from "@/components/admin/tonight/ArrivalRow";
import type { BookingDetailDto } from "@/api/admin";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";
import { at, booking, NOW } from "./fixtures";

const colorScheme = { current: "light" as "light" | "dark" };
jest.mock("@/hooks/use-color-scheme", () => ({ useColorScheme: () => colorScheme.current }));
jest.mock("@/utils/haptics", () => ({
  haptics: { selection: jest.fn(), press: jest.fn(), outcome: jest.fn() },
}));

function renderRow(
  b: BookingDetailDto,
  over: { choosing?: boolean; ownTableFree?: boolean; isLast?: boolean } = {}
) {
  const onSetStatus = jest.fn();
  const onChooseTable = jest.fn();
  renderWithProviders(
    <ArrivalRow
      booking={b}
      nowMs={NOW}
      timezone="UTC"
      choosing={over.choosing ?? false}
      ownTableFree={over.ownTableFree ?? true}
      busy={false}
      isLast={over.isLast ?? false}
      onSetStatus={onSetStatus}
      onChooseTable={onChooseTable}
    />
  );
  return { onSetStatus, onChooseTable };
}

describe("ArrivalRow", () => {
  it("shows the time, how soon, the party and the table", () => {
    renderRow(booking({ date: at(25), seats: 4 }), { isLast: true });

    expect(screen.getByText("7:25 PM")).toBeTruthy();
    expect(screen.getByText("in 25 min")).toBeTruthy();
    expect(screen.getByText("Maya")).toBeTruthy();
    expect(screen.getByText("4 guests · T3")).toBeTruthy();
  });

  it("says how late a party is", () => {
    renderRow(booking({ date: at(-9) }));

    expect(screen.getByText("9 min late")).toBeTruthy();
  });

  it("shows a checked-in party and the note they left", () => {
    renderRow(booking({ status: "Arrived", specialRequests: "High chair", customerName: "" }));

    expect(screen.getByText("Checked in")).toBeTruthy();
    expect(screen.getByText("High chair")).toBeTruthy();
    expect(screen.getByText("Guest")).toBeTruthy();
  });

  it("offers each move the server allows", () => {
    const { onSetStatus } = renderRow(booking({ nextStatuses: ["Arrived", "Seated", "NoShow"] }));

    fireEvent.press(screen.getByTestId("arrival-arrived-1"));
    fireEvent.press(screen.getByTestId("arrival-seat-1"));
    fireEvent.press(screen.getByTestId("arrival-noshow-1"));
    expect(onSetStatus.mock.calls).toEqual([["Arrived"], ["Seated"], ["NoShow"]]);
  });

  it("offers no move the server doesn't", () => {
    renderRow(booking({ nextStatuses: ["Seated"] }));

    expect(screen.queryByTestId("arrival-arrived-1")).toBeNull();
    expect(screen.queryByTestId("arrival-noshow-1")).toBeNull();
  });

  it("holds Seat back while the booked table is taken", () => {
    renderRow(booking(), { ownTableFree: false });

    expect(screen.getByTestId("arrival-seat-1")).toBeDisabled();
  });

  it("picks the party up for the floor, and shows it as picked", () => {
    const { onChooseTable } = renderRow(booking(), { choosing: true });

    const choose = screen.getByTestId("arrival-choose-1");
    expect(choose).toBeSelected();
    fireEvent.press(choose);
    expect(onChooseTable).toHaveBeenCalled();
  });

  it("doesn't offer another table to a group booking", () => {
    renderRow(booking({ tableId: null, tableGroupId: 9, tableName: "Window booths" }));

    expect(screen.queryByTestId("arrival-choose-1")).toBeNull();
    expect(screen.getByTestId("arrival-seat-1")).toBeTruthy();
  });

  it("takes the dark-theme tones for late and checked-in in dark mode", () => {
    colorScheme.current = "dark";
    renderRow(booking({ date: at(-9), status: "Arrived" }));

    expect(screen.getByText("9 min late")).toHaveStyle({ color: "#fdba74" });
    expect(screen.getByText("Checked in")).toHaveStyle({ color: "#4ade80" });
    colorScheme.current = "light";
  });
});
