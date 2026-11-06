import React from "react";
import { fireEvent, screen } from "@testing-library/react-native";
import { FloorTile, type TilePick } from "@/components/admin/tonight/FloorTile";
import type { BookingDetailDto } from "@/api/admin";
import type { FloorUnit } from "@/api/tonight";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";
import { at, booking, NOW, unit } from "./fixtures";

const colorScheme = { current: "light" as "light" | "dark" };
jest.mock("@/hooks/use-color-scheme", () => ({ useColorScheme: () => colorScheme.current }));
jest.mock("@/utils/haptics", () => ({
  haptics: { selection: jest.fn(), press: jest.fn(), outcome: jest.fn() },
}));

function renderTile(
  over: {
    unit?: Partial<FloorUnit>;
    current?: BookingDetailDto;
    next?: BookingDetailDto;
    pick?: TilePick | null;
    busy?: boolean;
  } = {}
) {
  const onSetStatus = jest.fn();
  const onSeatHere = jest.fn();
  renderWithProviders(
    <FloorTile
      unit={unit(over.unit)}
      label="T3"
      current={over.current}
      next={over.next}
      nowMs={NOW}
      timezone="UTC"
      pick={over.pick ?? null}
      busy={over.busy ?? false}
      onSetStatus={onSetStatus}
      onSeatHere={onSeatHere}
    />
  );
  return { onSetStatus, onSeatHere };
}

describe("FloorTile", () => {
  it("names the state, the seats and the next booking on a free table", () => {
    renderTile({ unit: { nextBookingAt: at(120) } });

    expect(screen.getByTestId("tile-state-table-3")).toHaveTextContent("Free");
    expect(screen.getByLabelText("4 seats")).toBeTruthy();
    expect(screen.getByText("Next at 9:00 PM")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says so when nothing else is booked tonight", () => {
    renderTile();

    expect(screen.getByText("Nothing else booked tonight")).toBeTruthy();
  });

  it("marks a walk-in-only table", () => {
    renderTile({ unit: { walkInOnly: true } });

    expect(screen.getByText("Walk-in only")).toBeTruthy();
  });

  it("counts down a seated party and offers Finish", () => {
    const seated = booking({ status: "Seated", nextStatuses: ["Finished"] });
    const { onSetStatus } = renderTile({
      unit: { state: "seated", currentBookingId: 1, currentEndsAt: at(25) },
      current: seated,
    });

    expect(screen.getByText("Maya")).toBeTruthy();
    expect(screen.getByText("25 min left")).toBeTruthy();
    fireEvent.press(screen.getByTestId("tile-finish-table-3"));
    expect(onSetStatus).toHaveBeenCalledWith(seated, "Finished");
  });

  it("counts an overdue party's minutes over", () => {
    renderTile({
      unit: { state: "overdue", currentBookingId: 1, currentEndsAt: at(-12) },
      current: booking({ status: "Seated", nextStatuses: ["Finished"] }),
    });

    expect(screen.getByTestId("tile-state-table-3")).toHaveTextContent("Overdue");
    expect(screen.getByText("12 min over")).toBeTruthy();
    expect(screen.getByLabelText("Finish T3")).toBeTruthy();
  });

  it("shows no Finish once the server stops offering it", () => {
    renderTile({
      unit: { state: "seated", currentBookingId: 1, currentEndsAt: at(25) },
      current: booking({ status: "Seated", nextStatuses: [] }),
    });

    expect(screen.queryByTestId("tile-finish-table-3")).toBeNull();
  });

  it("shows who a booked-soon table is held for, and offers Seat", () => {
    const next = booking({ date: at(20), customerName: undefined });
    const { onSetStatus } = renderTile({ unit: { state: "bookedSoon", nextBookingId: 1 }, next });

    expect(screen.getByText("Guest")).toBeTruthy();
    expect(screen.getByText("in 20 min")).toBeTruthy();
    expect(screen.queryByTestId("tile-noshow-table-3")).toBeNull();
    fireEvent.press(screen.getByTestId("tile-seat-table-3"));
    expect(onSetStatus).toHaveBeenCalledWith(next, "Seated");
  });

  it("offers a no-show once the held party is late", () => {
    const next = booking({ date: at(-15), nextStatuses: ["Arrived", "Seated", "NoShow"] });
    const { onSetStatus } = renderTile({ unit: { state: "bookedSoon", nextBookingId: 1 }, next });

    expect(screen.getByText("15 min late")).toBeTruthy();
    fireEvent.press(screen.getByTestId("tile-noshow-table-3"));
    expect(onSetStatus).toHaveBeenCalledWith(next, "NoShow");
  });

  it("offers nothing for a held party the server has no move for", () => {
    renderTile({
      unit: { state: "bookedSoon", nextBookingId: 1 },
      next: booking({ nextStatuses: ["Arrived"] }),
    });

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("swaps its actions for Seat here while a party that fits is picked", () => {
    const { onSeatHere } = renderTile({ pick: { fit: "fits", partyName: "Ada" } });

    fireEvent.press(screen.getByLabelText("Seat Ada at T3"));
    expect(onSeatHere).toHaveBeenCalled();
  });

  it("offers Seat here on a booking's own held table", () => {
    renderTile({
      unit: { state: "bookedSoon", nextBookingId: 1 },
      next: booking(),
      pick: { fit: "own", partyName: "Maya" },
    });

    expect(screen.getByTestId("tile-seat-here-table-3")).toBeTruthy();
    expect(screen.queryByTestId("tile-seat-table-3")).toBeNull();
  });

  it.each([
    ["taken", "Not free"],
    ["tooSmall", "Too small"],
    ["groupMove", "Seat from the booking instead"],
    ["neededSoon", "Booked before they'd finish"],
  ] as const)("says why it can't take the picked party (%s)", (fit, reason) => {
    renderTile({ pick: { fit, partyName: "Ada" } });

    expect(screen.getByText(reason)).toBeTruthy();
    expect(screen.queryByTestId("tile-seat-here-table-3")).toBeNull();
  });

  it("takes the state's dark-theme tone in dark mode", () => {
    colorScheme.current = "dark";
    renderTile({
      unit: { state: "overdue", currentBookingId: 1, currentEndsAt: at(-3) },
      current: booking({ status: "Seated", nextStatuses: ["Finished"] }),
    });

    expect(screen.getByTestId("tile-state-table-3")).toHaveStyle({ color: "#fdba74" });
    colorScheme.current = "light";
  });
});
