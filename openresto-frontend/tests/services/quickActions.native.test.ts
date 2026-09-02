import { Platform } from "react-native";
import * as QuickActions from "expo-quick-actions";
import { registerQuickActions, resetInitialActionForTests } from "@/services/quickActions.native";
import { MY_BOOKING_ACTION_ID } from "@/constants/quickActions";

jest.mock("expo-quick-actions", () => ({
  initial: undefined,
  setItems: jest.fn(() => Promise.resolve()),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
}));

const mocked = QuickActions as unknown as {
  initial: { id: string } | undefined;
  setItems: jest.Mock;
  addListener: jest.Mock;
};

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });

/** The action payload handed to `setItems` on the most recent call. */
const publishedAction = () => mocked.setItems.mock.calls[0][0][0];

/** Fires a launch through the listener the service registered. */
const launchFrom = (id: string) => mocked.addListener.mock.calls[0][0]({ id });

beforeEach(() => {
  jest.clearAllMocks();
  mocked.setItems.mockResolvedValue(undefined);
  mocked.addListener.mockReturnValue({ remove: jest.fn() });
  mocked.initial = undefined;
  resetInitialActionForTests();
  setPlatform("ios");
});

describe("registerQuickActions (native)", () => {
  it("publishes the one action under the title it was given", () => {
    registerQuickActions({ title: "Ma réservation", onSelect: jest.fn() });

    expect(publishedAction()).toMatchObject({
      id: MY_BOOKING_ACTION_ID,
      title: "Ma réservation",
    });
  });

  it("takes an SF Symbol on iOS", () => {
    registerQuickActions({ title: "My booking", onSelect: jest.fn() });

    expect(publishedAction().icon).toBe("symbol:ticket");
  });

  // Apple's licence keeps SF Symbols off other platforms; Android falls back to the app icon.
  it("asks for no icon on Android", () => {
    setPlatform("android");
    registerQuickActions({ title: "My booking", onSelect: jest.fn() });

    expect(publishedAction().icon).toBeUndefined();
  });

  it("routes a launch from the action", () => {
    const onSelect = jest.fn();
    registerQuickActions({ title: "My booking", onSelect });

    launchFrom(MY_BOOKING_ACTION_ID);

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("ignores a launch from some other action", () => {
    const onSelect = jest.fn();
    registerQuickActions({ title: "My booking", onSelect });

    launchFrom("something-else");

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("acts on the action that cold-started the app", () => {
    mocked.initial = { id: MY_BOOKING_ACTION_ID };
    const onSelect = jest.fn();

    registerQuickActions({ title: "My booking", onSelect });

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  /**
   * `initial` is a snapshot taken at launch and never cleared, so a second registration — a
   * remount, or the guest switching language — must not navigate them back to lookup from
   * wherever they have since got to.
   */
  it("acts on the cold-start action only once per process", () => {
    mocked.initial = { id: MY_BOOKING_ACTION_ID };
    const onSelect = jest.fn();

    registerQuickActions({ title: "My booking", onSelect });
    registerQuickActions({ title: "Ma réservation", onSelect });

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("does not treat a cold start from another action as its own", () => {
    mocked.initial = { id: "something-else" };
    const onSelect = jest.fn();

    registerQuickActions({ title: "My booking", onSelect });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("stops listening when torn down", () => {
    const remove = jest.fn();
    mocked.addListener.mockReturnValue({ remove });

    registerQuickActions({ title: "My booking", onSelect: jest.fn() })();

    expect(remove).toHaveBeenCalledTimes(1);
  });

  // A device that refuses shortcuts still has to render the app.
  it("swallows a device that rejects the shortcuts", () => {
    mocked.setItems.mockRejectedValue(new Error("no shortcut manager"));

    expect(() => registerQuickActions({ title: "My booking", onSelect: jest.fn() })).not.toThrow();
  });
});
