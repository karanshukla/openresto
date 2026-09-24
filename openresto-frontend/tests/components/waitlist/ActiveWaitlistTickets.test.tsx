import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import ActiveWaitlistTickets from "@/components/waitlist/ActiveWaitlistTickets";
import { WAITLIST_POLL_MS } from "@/components/waitlist/useWaitlistEntry";
import { getWaitlistStatus, leaveWaitlist, type WaitlistEntryStatus } from "@/api/waitlist";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@/hooks/use-color-scheme", () => ({ useColorScheme: () => "light" }));
jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));
jest.mock("@/api/waitlist", () => ({
  getWaitlistStatus: jest.fn(),
  leaveWaitlist: jest.fn(),
}));
jest.mock("@/components/common/ConfirmModal", () => require("../../../jest-mocks/ConfirmModal"));

const mockStatus = getWaitlistStatus as jest.Mock;

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

const onLoaded = jest.fn();
const onClosed = jest.fn();

const renderTickets = (entryRefs: string[]) =>
  render(<ActiveWaitlistTickets entryRefs={entryRefs} onLoaded={onLoaded} onClosed={onClosed} />);

beforeEach(() => jest.clearAllMocks());

describe("ActiveWaitlistTickets", () => {
  it.each(["waiting", "notified"] as const)(
    "shows a %s ticket and hands back its location",
    async (status) => {
      mockStatus.mockResolvedValue(entry({ status }));
      renderTickets(["abc"]);

      expect(await screen.findByTestId(`waitlist-status-${status}`)).toBeTruthy();
      expect(onLoaded).toHaveBeenCalledWith(3, "abc");
      expect(onClosed).not.toHaveBeenCalled();
    }
  );

  it.each(["seated", "left", "expired"] as const)(
    "shows nothing for a %s ticket and forgets it",
    async (status) => {
      mockStatus.mockResolvedValue(entry({ status, partiesAhead: null }));
      const { toJSON } = renderTickets(["abc"]);

      await waitFor(() => expect(onClosed).toHaveBeenCalledWith("abc"));
      expect(toJSON()).toBeNull();
    }
  );

  it("shows nothing for a ticket the server no longer knows, and forgets it", async () => {
    mockStatus.mockResolvedValue(null);
    const { toJSON } = renderTickets(["gone"]);

    await waitFor(() => expect(onClosed).toHaveBeenCalledWith("gone"));
    expect(toJSON()).toBeNull();
    expect(onLoaded).not.toHaveBeenCalled();
  });

  it("shows only the live tickets among several", async () => {
    mockStatus.mockImplementation(async (ref: string) =>
      ref === "live" ? entry({ ref }) : entry({ ref, status: "seated", partiesAhead: null })
    );
    renderTickets(["live", "done"]);

    await waitFor(() => expect(onClosed).toHaveBeenCalledWith("done"));
    expect(screen.getAllByTestId("waitlist-status-waiting")).toHaveLength(1);
  });

  it("drops the ticket once the guest leaves", async () => {
    mockStatus.mockResolvedValueOnce(entry()).mockResolvedValue(entry({ status: "left" }));
    (leaveWaitlist as jest.Mock).mockResolvedValue(true);
    renderTickets(["abc"]);

    fireEvent.press(await screen.findByTestId("waitlist-leave"));
    fireEvent.press(screen.getByText("Leave Waitlist"));

    await waitFor(() => expect(onClosed).toHaveBeenCalledWith("abc"));
    expect(screen.queryByTestId("waitlist-status-waiting")).toBeNull();
  });

  it("drops the ticket once the party is seated while it is on screen", async () => {
    jest.useFakeTimers();
    try {
      mockStatus
        .mockResolvedValueOnce(entry({ status: "notified" }))
        .mockResolvedValue(entry({ status: "seated", partiesAhead: null }));
      renderTickets(["abc"]);
      await screen.findByTestId("waitlist-status-notified");

      await act(async () => {
        jest.advanceTimersByTime(WAITLIST_POLL_MS);
      });

      expect(onClosed).toHaveBeenCalledWith("abc");
      expect(screen.queryByTestId("waitlist-status-notified")).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
