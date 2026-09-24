import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import WaitlistTicket from "@/components/waitlist/WaitlistTicket";
import { WAITLIST_POLL_MS, useWaitlistEntry } from "@/components/waitlist/useWaitlistEntry";
import { getWaitlistStatus, leaveWaitlist, type WaitlistEntryStatus } from "@/api/waitlist";
import haptics from "@/utils/haptics";
import { confirm } from "@/utils/confirm";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@/hooks/use-color-scheme", () => ({ useColorScheme: () => "light" }));
jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));
jest.mock("@/api/waitlist", () => ({
  getWaitlistStatus: jest.fn(),
  leaveWaitlist: jest.fn(),
}));
jest.mock("@/utils/haptics", () => {
  const mock = { outcome: jest.fn(), press: jest.fn() };
  return { __esModule: true, default: mock, haptics: mock };
});
jest.mock("@/utils/confirm", () => ({ confirm: jest.fn() }));

const mockStatus = getWaitlistStatus as jest.Mock;
const mockLeave = leaveWaitlist as jest.Mock;
const mockConfirm = confirm as jest.Mock;

const entry = (over: Partial<WaitlistEntryStatus> = {}): WaitlistEntryStatus => ({
  ref: "abc",
  number: 12,
  restaurantId: 3,
  restaurantName: "Door",
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

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockConfirm.mockResolvedValue(true);
});

afterEach(() => jest.useRealTimers());

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

/** The card as both the Locations drawer and My Bookings mount it: over the entry's own hook. */
function Ticket({ entryRef }: { entryRef: string }) {
  return <WaitlistTicket state={useWaitlistEntry(entryRef)} />;
}

describe("WaitlistTicket", () => {
  it("shows the guest's ticket, place and wait", async () => {
    mockStatus.mockResolvedValue(entry());
    render(<Ticket entryRef="abc" />);

    expect(await screen.findByText("You're on the list")).toBeTruthy();
    expect(screen.getByText("Door")).toBeTruthy();
    expect(screen.getByText("2 parties ahead of you")).toBeTruthy();
    expect(screen.getByText("#12")).toBeTruthy();
    expect(screen.getByText("25 min")).toBeTruthy();
  });

  it("tells a guest who opted in to push that a notification is coming", async () => {
    mockStatus.mockResolvedValue(entry({ pushEnabled: true }));
    render(<Ticket entryRef="abc" />);

    expect(await screen.findByText(/You'll get a notification/)).toBeTruthy();
  });

  it("gives a guest without push no line about notifications", async () => {
    mockStatus.mockResolvedValue(entry());
    render(<Ticket entryRef="abc" />);
    await screen.findByText("You're on the list");

    expect(screen.queryByText(/notification/)).toBeNull();
  });

  it("says the guest is next with nobody ahead", async () => {
    mockStatus.mockResolvedValue(entry({ partiesAhead: 0, estimatedWaitMinutes: 0 }));
    render(<Ticket entryRef="abc" />);

    expect(await screen.findByText("You're next")).toBeTruthy();
    expect(screen.getByText("Now")).toBeTruthy();
  });

  it("re-reads the place while queued, and buzzes once when the party is called", async () => {
    mockStatus
      .mockResolvedValueOnce(entry())
      .mockResolvedValueOnce(entry({ status: "notified" }))
      .mockResolvedValue(entry({ status: "notified" }));
    render(<Ticket entryRef="abc" />);
    await screen.findByText("You're on the list");

    await advance(WAITLIST_POLL_MS);
    expect(await screen.findByText("Your table is ready")).toBeTruthy();
    expect(screen.getByText("Please head to the host stand.")).toBeTruthy();

    await advance(WAITLIST_POLL_MS);
    expect(mockStatus).toHaveBeenCalledTimes(3);
    expect(haptics.outcome).toHaveBeenCalledTimes(1);
  });

  it("stops polling once the entry has left the queue", async () => {
    mockStatus.mockResolvedValue(entry({ status: "seated", partiesAhead: null }));
    render(<Ticket entryRef="abc" />);
    await screen.findByText("Enjoy your meal");

    await advance(WAITLIST_POLL_MS * 3);

    expect(mockStatus).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("waitlist-leave")).toBeNull();
  });

  it("shows when a closed ticket joined in place of the wait", async () => {
    mockStatus.mockResolvedValue(entry({ status: "seated", partiesAhead: null }));
    render(<Ticket entryRef="abc" />);
    await screen.findByText("Enjoy your meal");

    expect(screen.getByText("Joined")).toBeTruthy();
    expect(screen.queryByText("Wait")).toBeNull();
  });

  it("marks a wait no table can seat rather than guessing one", async () => {
    mockStatus.mockResolvedValue(entry({ estimatedWaitMinutes: null }));
    render(<Ticket entryRef="abc" />);

    expect(await screen.findByText("—")).toBeTruthy();
  });

  it.each([
    ["left", "You've left the waitlist"],
    ["expired", "This waitlist entry has expired"],
  ] as const)("titles a %s entry", async (status, title) => {
    mockStatus.mockResolvedValue(entry({ status }));
    render(<Ticket entryRef="abc" />);

    expect(await screen.findByText(title)).toBeTruthy();
  });

  it("says so for an unknown ref", async () => {
    mockStatus.mockResolvedValue(null);
    render(<Ticket entryRef="nope" />);

    expect(await screen.findByTestId("waitlist-not-found")).toBeTruthy();
  });

  it("reports a first load that failed", async () => {
    mockStatus.mockResolvedValue(undefined);
    render(<Ticket entryRef="abc" />);

    expect(await screen.findByText("Couldn't load the waitlist. Please try again.")).toBeTruthy();
  });

  it("keeps the last place shown when a refresh fails", async () => {
    mockStatus.mockResolvedValueOnce(entry()).mockResolvedValue(undefined);
    render(<Ticket entryRef="abc" />);
    await screen.findByText("You're on the list");

    await advance(WAITLIST_POLL_MS);

    expect(await screen.findByText("Couldn't refresh your place in line.")).toBeTruthy();
    expect(screen.getByText("You're on the list")).toBeTruthy();
  });

  it("leaves the waitlist once confirmed", async () => {
    mockStatus.mockResolvedValueOnce(entry()).mockResolvedValue(entry({ status: "left" }));
    mockLeave.mockResolvedValue(true);
    render(<Ticket entryRef="abc" />);
    await screen.findByText("You're on the list");

    fireEvent.press(screen.getByTestId("waitlist-leave"));

    expect(await screen.findByText("You've left the waitlist")).toBeTruthy();
    expect(mockLeave).toHaveBeenCalledWith("abc");
  });

  it("stays put when the guest backs out of leaving", async () => {
    mockStatus.mockResolvedValue(entry());
    mockConfirm.mockResolvedValue(false);
    render(<Ticket entryRef="abc" />);
    await screen.findByText("You're on the list");

    fireEvent.press(screen.getByTestId("waitlist-leave"));

    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(mockLeave).not.toHaveBeenCalled();
  });

  it("says so when leaving fails", async () => {
    mockStatus.mockResolvedValue(entry());
    mockLeave.mockResolvedValue(false);
    render(<Ticket entryRef="abc" />);
    await screen.findByText("You're on the list");

    fireEvent.press(screen.getByTestId("waitlist-leave"));

    expect(await screen.findByText("Couldn't leave the waitlist. Please try again.")).toBeTruthy();
  });
});
