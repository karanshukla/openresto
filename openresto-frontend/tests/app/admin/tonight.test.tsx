/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { Platform } from "react-native";
import TonightScreen, { TONIGHT_POLL_MS } from "@/app/admin/tonight";
import * as restaurantsApi from "@/api/restaurants";
import * as adminApi from "@/api/admin";
import * as waitlistApi from "@/api/waitlist";
import * as tonightApi from "@/api/tonight";
import type { Tonight } from "@/api/tonight";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";
import { at, booking, NOW, unit } from "@/tests/components/admin/tonight/fixtures";

jest.mock("expo-router", () => {
  const Screen = () => null;
  Screen.displayName = "Screen";
  return { Stack: { Screen } };
});
jest.mock("@/utils/haptics", () => ({
  haptics: { selection: jest.fn(), press: jest.fn(), outcome: jest.fn() },
}));
jest.mock("@/api/restaurants", () => ({ fetchRestaurants: jest.fn() }));
jest.mock("@/components/common/ConfirmModal", () => require("../../../jest-mocks/ConfirmModal"));
jest.mock("@/api/admin", () => ({ adminSetBookingStatus: jest.fn() }));
jest.mock("@/api/waitlist", () => ({ actOnWaitlistEntry: jest.fn() }));
jest.mock("@/api/tonight", () => ({
  getTonight: jest.fn(),
  moveBookingToTable: jest.fn(),
  seatWaitlistEntryAt: jest.fn(),
}));

const mockRestaurants = restaurantsApi.fetchRestaurants as jest.Mock;
const mockTonight = tonightApi.getTonight as jest.Mock;
const mockMove = tonightApi.moveBookingToTable as jest.Mock;
const mockSeatAt = tonightApi.seatWaitlistEntryAt as jest.Mock;
const mockStatus = adminApi.adminSetBookingStatus as jest.Mock;
const mockAct = waitlistApi.actOnWaitlistEntry as jest.Mock;

const party = (over: Partial<waitlistApi.WaitlistEntry> = {}): waitlistApi.WaitlistEntry => ({
  id: 40,
  number: 7,
  name: "Ada",
  email: null,
  seats: 2,
  status: "waiting",
  joinedAt: at(-10),
  notifiedAt: null,
  partiesAhead: 0,
  estimatedWaitMinutes: 0,
  canSeatNow: true,
  skipsNumber: null,
  ...over,
});

/**
 * T1 seated (Maya), T2 free, T3 held for Priya who is late, T4 free; group 9 is T2+T4.
 * Ada (2) waits, and only T2 is free for her whole sitting.
 */
function tonight(over: Partial<Tonight> = {}): Tonight {
  return {
    restaurantId: 1,
    restaurantName: "Flagship",
    timezone: "UTC",
    now: new Date(NOW).toISOString(),
    bookedSoonMinutes: 30,
    sections: [
      {
        id: 1,
        name: "Indoor",
        units: [
          unit({ id: 1, name: "T1", state: "seated", currentBookingId: 11, currentEndsAt: at(30) }),
          unit({ id: 2, name: "T2", seats: 2 }),
          unit({ id: 3, name: "", state: "bookedSoon", nextBookingId: 13, nextBookingAt: at(-10) }),
          unit({ id: 4, name: "T4", seats: 4, nextBookingAt: at(20) }),
        ],
      },
    ],
    groups: [unit({ kind: "group", id: 9, name: "T2 + T4", seats: 6, memberTableIds: [2, 4] })],
    bookings: [
      booking({
        id: 11,
        tableId: 1,
        tableName: "T1",
        customerName: "Maya",
        status: "Seated",
        nextStatuses: ["Finished"],
        date: at(-30),
      }),
      booking({
        id: 13,
        tableId: 3,
        tableName: "Table 3",
        customerName: "Priya",
        date: at(-10),
        nextStatuses: ["Arrived", "Seated", "NoShow"],
      }),
      booking({ id: 14, tableId: 4, tableName: "T4", customerName: "Sam", date: at(20), seats: 2 }),
      booking({
        id: 15,
        tableId: null,
        tableGroupId: 9,
        tableName: "T2 + T4",
        customerName: "Group",
        date: at(150),
        seats: 6,
      }),
    ],
    waitlist: { restaurantId: 1, acceptingGuests: true, entries: [party()] },
    seatableNow: [{ seats: 2, tableIds: [2], tableGroupIds: [] }],
    ...over,
  };
}

const wide = () =>
  fireEvent(screen.getByTestId("tonight-screen"), "layout", {
    nativeEvent: { layout: { width: 1200, height: 800 } },
  });

async function renderScreen() {
  renderWithProviders(<TonightScreen />);
  await screen.findByTestId("tile-table-1", {}, { timeout: 5000 });
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  jest.spyOn(Date, "now").mockReturnValue(NOW);
  mockRestaurants.mockResolvedValue([
    { id: 1, name: "Flagship" },
    { id: 2, name: "Patio" },
  ]);
  mockTonight.mockResolvedValue(tonight());
  mockStatus.mockImplementation(async (id: number, status: string) =>
    booking({ id, status: status as adminApi.BookingStatus, undoStatus: "Booked" })
  );
  mockMove.mockResolvedValue({ ok: true, value: null });
  mockSeatAt.mockResolvedValue({ ok: true, value: null });
  mockAct.mockResolvedValue({ ok: true, value: null });
});

afterEach(() => jest.restoreAllMocks());

describe("admin tonight", () => {
  it("opens on the first location with the floor, the arrivals and the waitlist", async () => {
    await renderScreen();
    wide();

    expect(mockTonight).toHaveBeenCalledWith(1);
    expect(screen.getByTestId("tonight-layout-three")).toBeTruthy();
    expect(screen.getByText("25 min left".replace("25", "30"))).toBeTruthy();
    expect(screen.getByText("Table 3")).toBeTruthy(); // an unnamed table falls back to its id
    expect(within(screen.getByTestId("arrivals-late")).getByText("Priya")).toBeTruthy();
    expect(within(screen.getByTestId("arrivals-nextHour")).getByText("Sam")).toBeTruthy();
    expect(within(screen.getByTestId("arrivals-later")).getByText("Group")).toBeTruthy();
    expect(screen.getByTestId("waitlist-row-40")).toBeTruthy();
    expect(screen.getByTestId("summary-free")).toHaveTextContent("2 free");
    expect(screen.getByTestId("summary-seated")).toHaveTextContent("1 seated");
    expect(screen.queryByTestId("summary-overdue")).toBeNull();
    expect(screen.getByTestId("summary-waiting")).toHaveTextContent("1 waiting");
    expect(screen.getByText("Combined tables")).toBeTruthy();
  });

  it("re-reads the floor on the poll", async () => {
    const interval = jest.spyOn(global, "setInterval");
    await renderScreen();

    const poll = interval.mock.calls.filter(([, ms]) => ms === TONIGHT_POLL_MS).at(-1);
    await act(async () => {
      (poll![0] as () => void)();
    });

    expect(mockTonight).toHaveBeenCalledTimes(2);
  });

  it("keeps the last floor on screen when a poll fails", async () => {
    const interval = jest.spyOn(global, "setInterval");
    await renderScreen();
    mockTonight.mockResolvedValueOnce(null);

    const poll = interval.mock.calls.filter(([, ms]) => ms === TONIGHT_POLL_MS).at(-1);
    await act(async () => {
      (poll![0] as () => void)();
    });

    expect(screen.getByTestId("tile-table-1")).toBeTruthy();
    expect(screen.getByTestId("tonight-updated")).toHaveTextContent(/Couldn't load/);
  });

  it("offers a retry when the first read fails", async () => {
    mockTonight.mockResolvedValueOnce(null);
    renderWithProviders(<TonightScreen />);

    fireEvent.press(await screen.findByText("Try again", {}, { timeout: 5000 }));

    expect(await screen.findByTestId("tile-table-1")).toBeTruthy();
  });

  it("says so when there are no locations", async () => {
    mockRestaurants.mockResolvedValue([]);
    renderWithProviders(<TonightScreen />);

    expect(await screen.findByText("Add a location to run the host view.")).toBeTruthy();
    expect(mockTonight).not.toHaveBeenCalled();
  });

  it("switches location from the pills", async () => {
    await renderScreen();

    fireEvent.press(screen.getByRole("radio", { name: "Patio" }));

    await waitFor(() => expect(mockTonight).toHaveBeenLastCalledWith(2));
  });

  it("finishes a table in one press and offers to undo it", async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId("tile-finish-table-1"));

    expect(await screen.findByText("T1 is free")).toBeTruthy();
    expect(mockStatus).toHaveBeenCalledWith(11, "Finished");

    fireEvent.press(screen.getByTestId("undo-bar-undo"));
    expect(await screen.findByText("Undone")).toBeTruthy();
    expect(mockStatus).toHaveBeenLastCalledWith(11, "Booked");
    expect(screen.queryByTestId("undo-bar-undo")).toBeNull();
  });

  it("confirms without an undo when the server offers none", async () => {
    mockStatus.mockResolvedValueOnce(booking({ id: 13, undoStatus: null }));
    await renderScreen();
    wide();

    fireEvent.press(screen.getByTestId("arrival-noshow-13"));

    expect(await screen.findByText("Priya marked as a no-show")).toBeTruthy();
    expect(screen.queryByTestId("undo-bar-undo")).toBeNull();
  });

  it("checks a party in and seats one from the arrivals", async () => {
    await renderScreen();
    wide();

    fireEvent.press(screen.getByTestId("arrival-arrived-14"));
    expect(await screen.findByText("Sam checked in")).toBeTruthy();

    fireEvent.press(screen.getByTestId("arrival-seat-13"));
    expect(await screen.findByText("Priya seated at Table 3")).toBeTruthy();
  });

  it("seats the party a booked-soon tile is held for", async () => {
    await renderScreen();

    fireEvent.press(screen.getByTestId("tile-seat-table-3"));

    expect(await screen.findByText("Priya seated at Table 3")).toBeTruthy();
    expect(mockStatus).toHaveBeenCalledWith(13, "Seated");
    expect(mockMove).not.toHaveBeenCalled();
  });

  it("shows the server's reason when a move is refused", async () => {
    mockStatus.mockRejectedValueOnce(
      new Error("A booking that is Seated cannot be marked Seated.")
    );
    await renderScreen();

    fireEvent.press(screen.getByTestId("tile-seat-table-3"));

    expect(await screen.findByTestId("tonight-error")).toHaveTextContent(
      "A booking that is Seated cannot be marked Seated."
    );
  });

  it("seats a waitlist party on the tile the host picks, passing the table through", async () => {
    await renderScreen();
    wide();

    fireEvent.press(screen.getByTestId("waitlist-choose-40"));
    expect(screen.getByTestId("pick-banner")).toHaveTextContent(/Seating Ada, 2 guests/);
    // T4 is free now but booked before a whole sitting; T1 is taken.
    expect(
      within(screen.getByTestId("tile-table-4")).getByText("Booked before they'd finish")
    ).toBeTruthy();
    expect(within(screen.getByTestId("tile-table-1")).getByText("Not free")).toBeTruthy();

    fireEvent.press(screen.getByTestId("tile-seat-here-table-2"));

    expect(await screen.findByText("Ada seated at T2")).toBeTruthy();
    expect(mockSeatAt).toHaveBeenCalledWith(40, expect.objectContaining({ kind: "table", id: 2 }));
    expect(screen.queryByTestId("pick-banner")).toBeNull();
  });

  it("moves a booking to the picked table, then seats it", async () => {
    await renderScreen();
    wide();

    fireEvent.press(screen.getByTestId("arrival-choose-14"));
    fireEvent.press(screen.getByTestId("tile-seat-here-table-2"));

    expect(await screen.findByText("Sam seated at T2")).toBeTruthy();
    expect(mockMove).toHaveBeenCalledWith(14, 2);
    expect(mockStatus).toHaveBeenCalledWith(14, "Seated");
  });

  it("seats a picked booking on its own held table without moving it", async () => {
    await renderScreen();
    wide();

    fireEvent.press(screen.getByTestId("arrival-choose-13"));
    fireEvent.press(screen.getByTestId("tile-seat-here-table-3"));

    expect(await screen.findByText("Priya seated at Table 3")).toBeTruthy();
    expect(mockMove).not.toHaveBeenCalled();
    expect(mockStatus).toHaveBeenCalledWith(13, "Seated");
  });

  it("doesn't seat a booking whose move was refused", async () => {
    mockMove.mockResolvedValueOnce({ ok: false, message: "That table is taken." });
    await renderScreen();
    wide();

    fireEvent.press(screen.getByTestId("arrival-choose-14"));
    fireEvent.press(screen.getByTestId("tile-seat-here-table-2"));

    expect(await screen.findByTestId("tonight-error")).toHaveTextContent("That table is taken.");
    expect(mockStatus).not.toHaveBeenCalled();
  });

  it("reports a waitlist seat the server refused", async () => {
    mockSeatAt.mockResolvedValueOnce({ ok: false, message: "No free table." });
    await renderScreen();
    wide();

    fireEvent.press(screen.getByTestId("waitlist-choose-40"));
    fireEvent.press(screen.getByTestId("tile-seat-here-table-2"));

    expect(await screen.findByTestId("tonight-error")).toHaveTextContent("No free table.");
  });

  it("puts a picked party back down on a second press, on Cancel, or on Escape", async () => {
    const os = Platform.OS;
    Platform.OS = "web";
    await renderScreen();
    wide();

    fireEvent.press(screen.getByTestId("arrival-choose-14"));
    fireEvent.press(screen.getByTestId("arrival-choose-14"));
    expect(screen.queryByTestId("pick-banner")).toBeNull();

    fireEvent.press(screen.getByTestId("arrival-choose-14"));
    fireEvent.press(screen.getByTestId("pick-cancel"));
    expect(screen.queryByTestId("pick-banner")).toBeNull();

    fireEvent.press(screen.getByTestId("arrival-choose-14"));
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });
    expect(screen.getByTestId("pick-banner")).toBeTruthy();
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(screen.queryByTestId("pick-banner")).toBeNull();
    Platform.OS = os;
  });

  it("drops a picked party someone else has already seated", async () => {
    const interval = jest.spyOn(global, "setInterval");
    await renderScreen();
    wide();
    fireEvent.press(screen.getByTestId("waitlist-choose-40"));
    fireEvent.press(screen.getByTestId("arrival-choose-14"));

    const later = tonight();
    later.bookings = later.bookings.map((b) => (b.id === 14 ? { ...b, status: "Seated" } : b));
    mockTonight.mockResolvedValueOnce(later);
    const poll = interval.mock.calls.filter(([, ms]) => ms === TONIGHT_POLL_MS).at(-1);
    await act(async () => {
      (poll![0] as () => void)();
    });

    expect(screen.queryByTestId("pick-banner")).toBeNull();
  });

  it("drops a picked waitlist party who has left the queue", async () => {
    const interval = jest.spyOn(global, "setInterval");
    await renderScreen();
    wide();
    fireEvent.press(screen.getByTestId("waitlist-choose-40"));

    mockTonight.mockResolvedValueOnce(
      tonight({ waitlist: { restaurantId: 1, acceptingGuests: true, entries: [] } })
    );
    const poll = interval.mock.calls.filter(([, ms]) => ms === TONIGHT_POLL_MS).at(-1);
    await act(async () => {
      (poll![0] as () => void)();
    });

    expect(screen.queryByTestId("pick-banner")).toBeNull();
    expect(screen.getByText("No one is waiting")).toBeTruthy();
  });

  it("calls, seats and removes waitlist parties, removing only after a confirm", async () => {
    await renderScreen();
    wide();

    fireEvent.press(screen.getByTestId("waitlist-call-40"));
    await waitFor(() => expect(mockAct).toHaveBeenCalledWith(40, "notify"));

    fireEvent.press(screen.getByTestId("waitlist-remove-40"));
    expect(mockAct).not.toHaveBeenCalledWith(40, "remove");
    fireEvent.press(within(screen.getByTestId("confirm-modal")).getByText("Remove"));
    await waitFor(() => expect(mockAct).toHaveBeenCalledWith(40, "remove"));

    mockAct.mockResolvedValueOnce({ ok: false, message: "Already gone." });
    fireEvent.press(screen.getByTestId("waitlist-seat-40"));
    expect(await screen.findByTestId("tonight-error")).toHaveTextContent("Already gone.");
  });

  it("keeps a waitlist party when the remove is cancelled", async () => {
    await renderScreen();
    wide();

    fireEvent.press(screen.getByTestId("waitlist-remove-40"));
    fireEvent.press(within(screen.getByTestId("confirm-modal")).getByText("Cancel"));

    expect(screen.queryByTestId("confirm-modal")).toBeNull();
    expect(mockAct).not.toHaveBeenCalled();
  });

  it("shows empty arrivals and an empty waitlist", async () => {
    mockTonight.mockResolvedValue(
      tonight({ bookings: [], waitlist: { restaurantId: 1, acceptingGuests: true, entries: [] } })
    );
    await renderScreen();
    wide();

    expect(screen.getByText("No one else is due tonight")).toBeTruthy();
    expect(screen.getByText("No one is waiting")).toBeTruthy();
  });

  it("counts overdue tables in the header", async () => {
    const data = tonight();
    data.sections[0].units[0] = {
      ...data.sections[0].units[0],
      state: "overdue",
      currentEndsAt: at(-5),
    };
    mockTonight.mockResolvedValue(data);
    await renderScreen();

    expect(screen.getByTestId("summary-overdue")).toHaveTextContent("1 overdue");
  });

  it("puts arrivals and waitlist in tabs beside the floor at a middling width", async () => {
    await renderScreen();
    fireEvent(screen.getByTestId("tonight-screen"), "layout", {
      nativeEvent: { layout: { width: 800, height: 800 } },
    });

    expect(screen.getByTestId("tonight-layout-two")).toBeTruthy();
    expect(screen.getByTestId("pane-floor")).toBeTruthy();
    expect(screen.getByTestId("pane-arrivals")).toBeTruthy();
    fireEvent.press(screen.getByTestId("tab-waitlist"));
    expect(screen.getByTestId("pane-waitlist")).toBeTruthy();
    expect(screen.queryByTestId("pane-arrivals")).toBeNull();
  });

  it("puts every pane in tabs on a narrow screen, and jumps to the floor on a pick", async () => {
    await renderScreen();
    fireEvent(screen.getByTestId("tonight-screen"), "layout", {
      nativeEvent: { layout: { width: 500, height: 800 } },
    });

    expect(screen.getByTestId("tonight-layout-one")).toBeTruthy();
    fireEvent.press(screen.getByTestId("tab-arrivals"));
    expect(screen.queryByTestId("pane-floor")).toBeNull();
    expect(screen.getByTestId("tab-arrivals")).toBeSelected();

    fireEvent.press(screen.getByTestId("arrival-choose-14"));

    expect(screen.getByTestId("pane-floor")).toBeTruthy();
    expect(screen.getByTestId("pick-banner")).toBeTruthy();
  });

  it("names a hidden guest generically", async () => {
    const data = tonight();
    data.bookings = data.bookings.map((b) => ({ ...b, customerName: undefined }));
    mockTonight.mockResolvedValue(data);
    await renderScreen();

    fireEvent.press(screen.getByTestId("tile-finish-table-1"));

    expect(await screen.findByText("T1 is free")).toBeTruthy();
    fireEvent.press(screen.getByTestId("tile-seat-table-3"));
    expect(await screen.findByText("Guest seated at Table 3")).toBeTruthy();
  });
});
