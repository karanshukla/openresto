/**
 * @jest-environment jsdom
 */
import React from "react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";
import WaitlistScreen, { BOARD_POLL_MS } from "@/app/admin/waitlist";
import * as restaurantsApi from "@/api/restaurants";
import * as waitlistApi from "@/api/waitlist";
import { renderWithProviders } from "@/tests/helpers/renderWithProviders";

jest.mock("expo-router", () => {
  const Screen = () => null;
  Screen.displayName = "Screen";
  return { Stack: { Screen } };
});
jest.mock("@/utils/haptics", () => ({
  haptics: { selection: jest.fn(), press: jest.fn(), outcome: jest.fn() },
}));
jest.mock("@/api/restaurants", () => ({ fetchRestaurants: jest.fn() }));
jest.mock("@/api/waitlist", () => ({
  getWaitlistBoard: jest.fn(),
  addWaitlistParty: jest.fn(),
  actOnWaitlistEntry: jest.fn(),
}));

const mockRestaurants = restaurantsApi.fetchRestaurants as jest.Mock;
const mockBoard = waitlistApi.getWaitlistBoard as jest.Mock;
const mockAdd = waitlistApi.addWaitlistParty as jest.Mock;
const mockAct = waitlistApi.actOnWaitlistEntry as jest.Mock;

const party = (over: Partial<waitlistApi.WaitlistEntry> = {}): waitlistApi.WaitlistEntry => ({
  id: 4,
  number: 7,
  name: "Ada",
  email: null,
  seats: 2,
  status: "waiting",
  joinedAt: new Date().toISOString(),
  notifiedAt: null,
  partiesAhead: 0,
  estimatedWaitMinutes: 0,
  canSeatNow: true,
  ...over,
});

const board = (entries: waitlistApi.WaitlistEntry[], acceptingGuests = true) => ({
  restaurantId: 1,
  acceptingGuests,
  entries,
});

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockRestaurants.mockResolvedValue([
    { id: 1, name: "Door" },
    { id: 2, name: "Patio" },
  ]);
  mockBoard.mockResolvedValue(board([party()]));
});

describe("admin waitlist", () => {
  it("opens on the first location and lists its queue", async () => {
    renderWithProviders(<WaitlistScreen />);

    // The first render in the file pays for loading every module, so it gets a longer window.
    expect(await screen.findByTestId("waitlist-row-4", {}, { timeout: 5000 })).toBeTruthy();
    expect(mockBoard).toHaveBeenCalledWith(1);
    expect(screen.getByTestId("waitlist-accepting")).toHaveTextContent(
      "Guests can join from the site right now."
    );
  });

  it("says when guests can't join from the site", async () => {
    mockBoard.mockResolvedValue(board([], false));
    renderWithProviders(<WaitlistScreen />);

    expect(await screen.findByText("No one is waiting.")).toBeTruthy();
    expect(screen.getByTestId("waitlist-accepting")).toHaveTextContent(/only while/);
  });

  it("switches location", async () => {
    renderWithProviders(<WaitlistScreen />);
    await screen.findByTestId("waitlist-row-4");

    fireEvent.press(screen.getByRole("radio", { name: "Patio" }));

    await waitFor(() => expect(mockBoard).toHaveBeenLastCalledWith(2));
  });

  it("asks for a location first when there are none", async () => {
    mockRestaurants.mockResolvedValue([]);
    renderWithProviders(<WaitlistScreen />);

    expect(await screen.findByText("Add a location to start a waitlist.")).toBeTruthy();
  });

  it("reports a board that couldn't load", async () => {
    mockBoard.mockResolvedValue(null);
    renderWithProviders(<WaitlistScreen />);

    expect(await screen.findByText("Couldn't load the waitlist.")).toBeTruthy();
  });

  it("re-reads the board on a timer, so guests joining online appear", async () => {
    const interval = jest.spyOn(global, "setInterval");
    renderWithProviders(<WaitlistScreen />);
    await screen.findByTestId("waitlist-row-4");

    const poll = interval.mock.calls.filter(([, ms]) => ms === BOARD_POLL_MS).at(-1);
    await act(async () => {
      (poll![0] as () => void)();
    });

    expect(mockBoard).toHaveBeenCalledTimes(2);
    interval.mockRestore();
  });

  it("adds a party and clears the form", async () => {
    mockAdd.mockResolvedValue({ ok: true, value: party({ id: 5 }) });
    renderWithProviders(<WaitlistScreen />);
    await screen.findByTestId("waitlist-row-4");

    expect(screen.getByTestId("waitlist-add-submit")).toBeDisabled();
    fireEvent.changeText(screen.getByTestId("waitlist-add-name"), " Bo ");
    fireEvent.changeText(screen.getByTestId("waitlist-add-email"), "bad");
    expect(screen.getByTestId("waitlist-add-submit")).toBeDisabled();
    fireEvent.changeText(screen.getByTestId("waitlist-add-email"), "bo@example.com");
    fireEvent.press(screen.getByLabelText(/^Party size, /));
    fireEvent.press(screen.getByRole("option", { name: "4 guests" }));
    fireEvent.press(screen.getByTestId("waitlist-add-submit"));

    await waitFor(() =>
      expect(mockAdd).toHaveBeenCalledWith(1, { name: "Bo", seats: 4, email: "bo@example.com" })
    );
    await waitFor(() => expect(screen.getByTestId("waitlist-add-name").props.value).toBe(""));
  });

  it("shows why an add was refused", async () => {
    mockAdd.mockResolvedValue({ ok: false, message: "No table here can seat a party of 12." });
    renderWithProviders(<WaitlistScreen />);
    await screen.findByTestId("waitlist-row-4");

    fireEvent.changeText(screen.getByTestId("waitlist-add-name"), "Bo");
    fireEvent.press(screen.getByTestId("waitlist-add-submit"));

    expect(await screen.findByTestId("waitlist-error")).toHaveTextContent(
      "No table here can seat a party of 12."
    );
    expect(mockAdd).toHaveBeenCalledWith(1, { name: "Bo", seats: 2, email: undefined });
  });

  it("acts on a party and refreshes the board", async () => {
    mockAct.mockResolvedValue({ ok: true, value: null });
    renderWithProviders(<WaitlistScreen />);
    await screen.findByTestId("waitlist-row-4");

    fireEvent.press(screen.getByTestId("waitlist-seat-4"));

    await waitFor(() => expect(mockAct).toHaveBeenCalledWith(4, "seat"));
    await waitFor(() => expect(mockBoard).toHaveBeenCalledTimes(2));
  });

  it("shows why an action was refused", async () => {
    mockAct.mockResolvedValue({
      ok: false,
      message: "No free table can seat this party right now.",
    });
    renderWithProviders(<WaitlistScreen />);
    await screen.findByTestId("waitlist-row-4");

    fireEvent.press(screen.getByTestId("waitlist-call-4"));

    expect(await screen.findByTestId("waitlist-error")).toHaveTextContent(
      "No free table can seat this party right now."
    );
  });

  it("titles the native header off web", async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
    renderWithProviders(<WaitlistScreen />);

    expect(await screen.findByTestId("waitlist-row-4")).toBeTruthy();
    Object.defineProperty(Platform, "OS", { value: original, configurable: true });
  });
});
