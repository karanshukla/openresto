import React from "react";
import { fireEvent, screen } from "@testing-library/react-native";
import WaitlistRow from "@/components/admin/waitlist/WaitlistRow";
import type { WaitlistEntry } from "@/api/waitlist";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

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
  estimatedWaitMinutes: 15,
  canSeatNow: false,
  ...over,
});

describe("WaitlistRow", () => {
  it("shows the ticket, party and quoted wait", () => {
    renderWithProviders(<WaitlistRow entry={entry()} busy={false} onAction={jest.fn()} />);

    expect(screen.getByText("#7")).toBeTruthy();
    expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.getByText(/3 guests · Joined 12m ago/)).toBeTruthy();
    expect(screen.getByText("~15 min")).toBeTruthy();
  });

  it("offers Seat only when a table can take the party now", () => {
    const onAction = jest.fn();
    const first = renderWithProviders(
      <WaitlistRow entry={entry()} busy={false} onAction={onAction} />
    );
    expect(screen.getByTestId("waitlist-seat-4")).toBeDisabled();
    first.unmount();

    renderWithProviders(
      <WaitlistRow
        entry={entry({ canSeatNow: true, estimatedWaitMinutes: 0 })}
        busy={false}
        onAction={onAction}
      />
    );
    expect(screen.getByText("Table free now")).toBeTruthy();
    fireEvent.press(screen.getByTestId("waitlist-seat-4"));
    expect(onAction).toHaveBeenCalledWith("seat");
  });

  it("calls, and offers to call again once called", () => {
    const onAction = jest.fn();
    const first = renderWithProviders(
      <WaitlistRow entry={entry()} busy={false} onAction={onAction} />
    );
    fireEvent.press(screen.getByText("Call"));
    expect(onAction).toHaveBeenCalledWith("notify");
    first.unmount();

    renderWithProviders(
      <WaitlistRow
        entry={entry({ status: "notified", notifiedAt: new Date().toISOString() })}
        busy={false}
        onAction={onAction}
      />
    );
    expect(screen.getByText("Call again")).toBeTruthy();
    expect(screen.getByText(/Called now/)).toBeTruthy();
  });

  it("removes a party", () => {
    const onAction = jest.fn();
    renderWithProviders(<WaitlistRow entry={entry()} busy={false} onAction={onAction} />);

    fireEvent.press(screen.getByTestId("waitlist-remove-4"));

    expect(onAction).toHaveBeenCalledWith("remove");
  });

  it("disables every action while one is in flight", () => {
    renderWithProviders(
      <WaitlistRow entry={entry({ canSeatNow: true })} busy onAction={jest.fn()} />
    );

    expect(screen.getByTestId("waitlist-remove-4")).toBeDisabled();
    expect(screen.getByTestId("waitlist-call-4")).toBeDisabled();
    expect(screen.getByTestId("waitlist-seat-4")).toBeDisabled();
  });

  it("stands in for guest details a key may not read, and shows an email when present", () => {
    const first = renderWithProviders(
      <WaitlistRow
        entry={entry({ name: null, estimatedWaitMinutes: null })}
        busy={false}
        onAction={jest.fn()}
      />
    );
    expect(screen.getByText("Guest details hidden")).toBeTruthy();
    expect(screen.getByText("No table fits")).toBeTruthy();
    first.unmount();

    renderWithProviders(
      <WaitlistRow entry={entry({ email: "ada@example.com" })} busy={false} onAction={jest.fn()} />
    );
    expect(screen.getByText(/ada@example.com/)).toBeTruthy();
  });
});
