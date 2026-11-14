import React from "react";
import { fireEvent, screen } from "@testing-library/react-native";
import { SeatOptions } from "@/components/admin/tonight/SeatOptions";
import { MAX_SEAT_OPTIONS } from "@/utils/tonight";
import type { FloorUnit } from "@/api/tonight";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";
import { unit } from "./fixtures";

jest.mock("@/utils/haptics", () => ({
  haptics: { selection: jest.fn(), press: jest.fn(), outcome: jest.fn() },
}));

const tables = (count: number) =>
  Array.from({ length: count }, (_, i) => unit({ id: i + 1, name: `T${i + 1}`, seats: 2 }));

function renderTray(options: FloorUnit[], busy = false) {
  const onSeat = jest.fn();
  renderWithProviders(
    <SeatOptions
      id="waitlist-4"
      partyName="Ada"
      options={options}
      labelFor={(u) => u.name}
      busy={busy}
      onSeat={onSeat}
    />
  );
  return onSeat;
}

describe("SeatOptions", () => {
  it("names each table with its size and seats the party at the one pressed", () => {
    const options = [unit({ id: 2, name: "T2", seats: 2 }), unit({ id: 5, name: "T5", seats: 1 })];
    const onSeat = renderTray(options);

    expect(screen.getByText("Seat Ada at")).toBeTruthy();
    expect(screen.getByText("T2 · 2 seats")).toBeTruthy();
    expect(screen.getByText("T5 · 1 seat")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Seat Ada at T5"));

    expect(onSeat).toHaveBeenCalledWith(options[1]);
  });

  it("offers every table at the cap without counting any as left over", () => {
    renderTray(tables(MAX_SEAT_OPTIONS));

    expect(screen.getAllByRole("button")).toHaveLength(MAX_SEAT_OPTIONS);
    expect(screen.queryByTestId("seat-options-more-waitlist-4")).toBeNull();
  });

  it("counts the tables past the cap instead of listing them", () => {
    renderTray(tables(MAX_SEAT_OPTIONS + 1));

    expect(screen.getAllByRole("button")).toHaveLength(MAX_SEAT_OPTIONS);
    expect(screen.getByTestId("seat-options-more-waitlist-4")).toHaveTextContent(
      "1 more table on the floor"
    );
  });

  it("holds every table back while a move is in flight", () => {
    renderTray(tables(2), true);

    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });
});
