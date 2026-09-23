import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import WaitlistPanel from "@/components/waitlist/WaitlistPanel";
import { getWaitlistQuote, getWaitlistStatus, type WaitlistEntryStatus } from "@/api/waitlist";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@/hooks/use-color-scheme", () => ({ useColorScheme: () => "light" }));
jest.mock("@/context/BrandContext", () => ({
  useBrand: () => ({ primaryColor: "#0a7ea4", appName: "Open Resto" }),
}));
jest.mock("@/context/LocaleContext", () => ({ useLocale: () => ({ locale: "en" }) }));

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));

jest.mock("@/api/waitlist", () => ({
  getWaitlistQuote: jest.fn(),
  getWaitlistStatus: jest.fn(),
  joinWaitlist: jest.fn(),
  leaveWaitlist: jest.fn(),
}));

const entry = (status: WaitlistEntryStatus["status"]): WaitlistEntryStatus => ({
  ref: "abc234",
  number: 4,
  restaurantId: 3,
  restaurantName: "Shore House",
  name: "Ada",
  seats: 2,
  status,
  partiesAhead: status === "waiting" ? 1 : null,
  estimatedWaitMinutes: status === "waiting" ? 15 : null,
  joinedAt: "2026-09-24T18:00:00Z",
  notifiedAt: null,
});

const props = {
  restaurantId: 3,
  seats: 2,
  onSeatsChange: jest.fn(),
  onJoined: jest.fn(),
  onReset: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  (getWaitlistQuote as jest.Mock).mockResolvedValue({
    restaurantId: 3,
    acceptingGuests: true,
    partiesWaiting: 0,
    estimatedWaitMinutes: 0,
  });
});

describe("WaitlistPanel", () => {
  it("offers the join form until the guest has a ticket", async () => {
    render(<WaitlistPanel {...props} />);

    expect(await screen.findByTestId("waitlist-join-submit")).toBeTruthy();
    expect(getWaitlistStatus).not.toHaveBeenCalled();
  });

  it("shows the ticket in place of the form once the guest has joined", async () => {
    (getWaitlistStatus as jest.Mock).mockResolvedValue(entry("waiting"));
    render(<WaitlistPanel {...props} entryRef="abc234" />);

    expect(await screen.findByTestId("waitlist-status-waiting")).toBeTruthy();
    expect(screen.queryByTestId("waitlist-join-submit")).toBeNull();
    fireEvent.press(screen.getByTestId("waitlist-open-ticket"));
    expect(mockPush).toHaveBeenCalledWith("/waitlist/abc234");
  });

  it("lets the guest join again once the ticket has left the queue", async () => {
    (getWaitlistStatus as jest.Mock).mockResolvedValue(entry("seated"));
    render(<WaitlistPanel {...props} entryRef="abc234" />);

    fireEvent.press(await screen.findByTestId("waitlist-join-again"));
    expect(props.onReset).toHaveBeenCalled();
    expect(screen.queryByTestId("waitlist-open-ticket")).toBeNull();
  });

  it("lets the guest join again when the ticket no longer exists", async () => {
    (getWaitlistStatus as jest.Mock).mockResolvedValue(null);
    render(<WaitlistPanel {...props} entryRef="gone" />);

    expect(await screen.findByTestId("waitlist-join-again")).toBeTruthy();
  });
});
