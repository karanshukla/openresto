import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import WaitlistTicketsList from "@/components/waitlist/WaitlistTicketsList";
import { getWaitlistStatus, type WaitlistEntryStatus } from "@/api/waitlist";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@/hooks/use-color-scheme", () => ({ useColorScheme: () => "light" }));
jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));
jest.mock("@/api/waitlist", () => ({ getWaitlistStatus: jest.fn() }));

const mockStatus = getWaitlistStatus as jest.Mock;

const entry = (over: Partial<WaitlistEntryStatus> = {}): WaitlistEntryStatus => ({
  ref: "abc",
  number: 12,
  restaurantId: 3,
  restaurantName: "Shore House",
  name: "Ada",
  seats: 2,
  status: "waiting",
  partiesAhead: 2,
  estimatedWaitMinutes: 25,
  joinedAt: "2026-09-26T19:00:00Z",
  notifiedAt: null,
  pushEnabled: false,
  ...over,
});

beforeEach(() => jest.clearAllMocks());

describe("WaitlistTicketsList", () => {
  it("renders nothing without tickets", () => {
    render(<WaitlistTicketsList entryRefs={[]} activeRef={null} onSelect={jest.fn()} />);
    expect(screen.queryByText("YOUR WAITLIST TICKETS")).toBeNull();
  });

  it("reads each ticket the way a booking row reads: number, then location, day and party", async () => {
    mockStatus.mockImplementation(async (ref: string) =>
      ref === "abc"
        ? entry()
        : entry({ ref, number: 3, restaurantName: "Dockside", status: "notified" })
    );
    render(
      <WaitlistTicketsList entryRefs={["abc", "def"]} activeRef={null} onSelect={jest.fn()} />
    );

    expect(await screen.findByText("Ticket #12")).toBeTruthy();
    expect(screen.getByText(/^Shore House · .+ · 2 guests$/)).toBeTruthy();
    expect(await screen.findByText("Ticket #3")).toBeTruthy();
    expect(screen.getByText(/^Dockside · /)).toBeTruthy();
  });

  it("says so for a ticket the server no longer knows", async () => {
    mockStatus.mockResolvedValue(null);
    render(<WaitlistTicketsList entryRefs={["gone"]} activeRef={null} onSelect={jest.fn()} />);

    expect(await screen.findByText("We couldn't find that waitlist entry.")).toBeTruthy();
  });

  it("opens the pressed ticket and marks the open one", async () => {
    mockStatus.mockResolvedValue(entry());
    const onSelect = jest.fn();
    render(<WaitlistTicketsList entryRefs={["abc"]} activeRef="abc" onSelect={onSelect} />);
    await screen.findByText("Ticket #12");

    const row = screen.getByTestId("waitlist-ticket-row-abc");
    expect(row.props.accessibilityState).toEqual({ selected: true });
    fireEvent.press(row);
    expect(onSelect).toHaveBeenCalledWith("abc");
  });
});
