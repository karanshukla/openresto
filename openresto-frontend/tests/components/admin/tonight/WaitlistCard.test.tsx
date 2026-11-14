import React from "react";
import { Text } from "react-native";
import { fireEvent, screen } from "@testing-library/react-native";
import { WaitlistCard } from "@/components/admin/tonight/WaitlistCard";
import type { WaitlistEntry } from "@/api/waitlist";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

const colorScheme = { current: "light" as "light" | "dark" };
jest.mock("@/hooks/use-color-scheme", () => ({ useColorScheme: () => colorScheme.current }));
jest.mock("@/utils/haptics", () => ({
  haptics: { selection: jest.fn(), press: jest.fn(), outcome: jest.fn() },
}));

const entry = (over: Partial<WaitlistEntry> = {}): WaitlistEntry => ({
  id: 4,
  number: 7,
  name: "Ada",
  email: null,
  seats: 3,
  status: "waiting",
  joinedAt: new Date(Date.now() - 12 * 60_000).toISOString(),
  notifiedAt: null,
  partiesAhead: 0,
  estimatedWaitMinutes: 0,
  canSeatNow: true,
  skipsNumber: null,
  ...over,
});

function renderCard(
  e: WaitlistEntry,
  over: { choosing?: boolean; tableCount?: number; onlyTable?: string; isLast?: boolean } = {}
) {
  const handlers = {
    onSeat: jest.fn(),
    onChooseTable: jest.fn(),
    onCall: jest.fn(),
    onRemove: jest.fn(),
  };
  renderWithProviders(
    <WaitlistCard
      entry={e}
      busy={false}
      isLast={over.isLast ?? false}
      choosing={over.choosing ?? false}
      tableCount={over.tableCount ?? 1}
      onlyTable={over.onlyTable}
      tray={<Text>the tables</Text>}
      {...handlers}
    />
  );
  return handlers;
}

afterEach(() => {
  colorScheme.current = "light";
});

describe("WaitlistCard", () => {
  it("shows the party size, who, the ticket and how long they've waited", () => {
    renderCard(entry(), { onlyTable: "T2" });

    expect(screen.getByLabelText("3 guests")).toHaveTextContent("3");
    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.getByText("#7")).toBeTruthy();
    expect(screen.getByText("Joined 12m ago")).toBeTruthy();
    expect(screen.getByTestId("waitlist-wait-4")).toHaveTextContent("Table free now");
  });

  it("names the table when exactly one can take the party, and seats them in one press", () => {
    const { onSeat, onChooseTable } = renderCard(entry(), { tableCount: 1, onlyTable: "T2" });

    expect(screen.queryByTestId("waitlist-choose-4")).toBeNull();
    const seat = screen.getByTestId("waitlist-seat-4");
    expect(seat).toHaveTextContent("Seat at T2");
    fireEvent.press(screen.getByLabelText("Seat Ada at T2"));

    expect(onSeat).toHaveBeenCalled();
    expect(onChooseTable).not.toHaveBeenCalled();
  });

  it("opens the table list instead of seating when two tables can take the party", () => {
    const { onSeat, onChooseTable } = renderCard(entry(), { tableCount: 2 });

    expect(screen.queryByTestId("waitlist-seat-4")).toBeNull();
    expect(screen.queryByText("the tables")).toBeNull();
    fireEvent.press(screen.getByLabelText("Choose a table for Ada"));

    expect(onChooseTable).toHaveBeenCalled();
    expect(onSeat).not.toHaveBeenCalled();
  });

  it("shows the table list while choosing, and turns the button into the way out", () => {
    colorScheme.current = "dark";
    const { onChooseTable } = renderCard(entry(), { tableCount: 2, choosing: true, isLast: true });

    expect(screen.getByText("the tables")).toBeTruthy();
    expect(screen.getByTestId("waitlist-choose-4")).toHaveTextContent("Cancel");
    fireEvent.press(screen.getByTestId("waitlist-choose-4"));
    expect(onChooseTable).toHaveBeenCalled();
  });

  it("falls back to a plain Seat when the server can seat them but no tile is known", () => {
    const { onSeat } = renderCard(entry(), { tableCount: 0 });

    const seat = screen.getByTestId("waitlist-seat-4");
    expect(seat).toHaveTextContent("Seat");
    expect(seat).not.toHaveTextContent("Seat at");
    fireEvent.press(screen.getByLabelText("Seat Ada"));
    expect(onSeat).toHaveBeenCalled();
  });

  it("holds Seat back and quotes the wait while no table can take the party", () => {
    renderCard(entry({ canSeatNow: false, estimatedWaitMinutes: 15 }), { tableCount: 0 });

    expect(screen.getByTestId("waitlist-seat-4")).toBeDisabled();
    expect(screen.getByTestId("waitlist-wait-4")).toHaveTextContent("~15 min");
  });

  it("says when no table fits at all", () => {
    renderCard(entry({ canSeatNow: false, estimatedWaitMinutes: null }), { tableCount: 0 });
    expect(screen.getByTestId("waitlist-wait-4")).toHaveTextContent("No table fits");
  });

  it("names the party a free table would let this one jump", () => {
    renderCard(entry({ skipsNumber: 5 }), { onlyTable: "T2" });
    expect(screen.getByTestId("waitlist-wait-4")).toHaveTextContent("Free now, skips #5");
  });

  it("calls a party, and calls a called party again", () => {
    const { onCall } = renderCard(
      entry({ status: "notified", notifiedAt: new Date(Date.now() - 3 * 60_000).toISOString() })
    );

    expect(screen.getByText("Called 3m ago")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Call Ada again"));
    expect(onCall).toHaveBeenCalled();
  });

  it("asks to remove a party, by ticket where the guest's name is hidden", () => {
    const { onRemove, onCall } = renderCard(entry({ name: null }));

    expect(screen.getByText("Guest details hidden")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Remove ticket #7"));
    expect(onRemove).toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText("Call ticket #7"));
    expect(onCall).toHaveBeenCalled();
  });
});
