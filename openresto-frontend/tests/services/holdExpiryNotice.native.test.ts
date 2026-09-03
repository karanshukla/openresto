import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import {
  scheduleHoldExpiryNotice,
  cancelHoldExpiryNotice,
  HOLD_CHANNEL_ID,
} from "@/services/holdExpiryNotice.native";
import { HOLD_EXPIRY_NOTICE_LEAD_SECONDS } from "@/components/booking/holdCountdown";

jest.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: "timeInterval" },
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn().mockResolvedValue("notice-1"),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
}));

const setPlatform = (os: string) =>
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });

const mocked = Notifications as unknown as {
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  setNotificationChannelAsync: jest.Mock;
  scheduleNotificationAsync: jest.Mock;
  cancelScheduledNotificationAsync: jest.Mock;
};

/** A hold expiring far enough out that the lead leaves a real delay to schedule. */
const HELD_SECONDS = 300;
const heldUntil = () => new Date(Date.now() + HELD_SECONDS * 1000).toISOString();

/**
 * The clock is frozen because these assertions straddle two reads of it: the expiry the test
 * builds, and the one `secondsUntilExpiry` takes inside the call. A millisecond between them
 * floors the delay a whole second short, so on a loaded runner the exact-seconds assertion
 * fails for a reason that has nothing to do with the code under test.
 */
beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
  jest.setSystemTime(new Date("2026-06-15T19:00:00.000Z"));
  jest.clearAllMocks();
  mocked.scheduleNotificationAsync.mockResolvedValue("notice-1");
  mocked.getPermissionsAsync.mockResolvedValue({ status: "granted" });
  setPlatform("ios");
});

afterEach(() => {
  jest.useRealTimers();
});

describe("scheduleHoldExpiryNotice (native)", () => {
  it("schedules the warning one lead ahead of expiry", async () => {
    await expect(scheduleHoldExpiryNotice(heldUntil())).resolves.toBe("notice-1");

    const trigger = mocked.scheduleNotificationAsync.mock.calls[0][0].trigger;
    expect(trigger.seconds).toBe(HELD_SECONDS - HOLD_EXPIRY_NOTICE_LEAD_SECONDS);
    expect(trigger.repeats).toBe(false);
  });

  it("carries the localized copy", async () => {
    await scheduleHoldExpiryNotice(heldUntil());

    const { title, body } = mocked.scheduleNotificationAsync.mock.calls[0][0].content;
    expect(title).toBe("Your table is still held");
    expect(body).toContain("One more minute");
  });

  // Taking a hold must never raise an OS dialog: the guest asked for a table, not for
  // notifications, and the prompt belongs to the confirmation screen's reminder toggle.
  it("warns when permission is already granted, without ever prompting", async () => {
    await expect(scheduleHoldExpiryNotice(heldUntil())).resolves.toBe("notice-1");
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("schedules nothing, and still does not prompt, when permission is undetermined", async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ status: "undetermined" });

    await expect(scheduleHoldExpiryNotice(heldUntil())).resolves.toBeNull();
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  // A guest who said no once is not asked again by the booking flow.
  it("schedules nothing when permission was refused earlier", async () => {
    mocked.getPermissionsAsync.mockResolvedValue({ status: "denied" });

    await expect(scheduleHoldExpiryNotice(heldUntil())).resolves.toBeNull();
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("schedules nothing for a hold too short to warn about, without prompting", async () => {
    const soon = new Date(Date.now() + 10_000).toISOString();

    await expect(scheduleHoldExpiryNotice(soon)).resolves.toBeNull();
    expect(mocked.getPermissionsAsync).not.toHaveBeenCalled();
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it("declares the Android channel and posts to it", async () => {
    setPlatform("android");
    await scheduleHoldExpiryNotice(heldUntil());

    expect(mocked.setNotificationChannelAsync).toHaveBeenCalledWith(
      HOLD_CHANNEL_ID,
      expect.objectContaining({ importance: 4 })
    );
    expect(mocked.scheduleNotificationAsync.mock.calls[0][0].content.channelId).toBe(
      HOLD_CHANNEL_ID
    );
  });

  it("leaves the channel to Android and does not name one on iOS", async () => {
    await scheduleHoldExpiryNotice(heldUntil());

    expect(mocked.setNotificationChannelAsync).not.toHaveBeenCalled();
    expect(mocked.scheduleNotificationAsync.mock.calls[0][0].content.channelId).toBeUndefined();
  });

  it("swallows a notifications module that throws", async () => {
    mocked.scheduleNotificationAsync.mockRejectedValue(new Error("no notification host"));

    await expect(scheduleHoldExpiryNotice(heldUntil())).resolves.toBeNull();
  });
});

describe("cancelHoldExpiryNotice (native)", () => {
  it("withdraws the scheduled warning", async () => {
    await cancelHoldExpiryNotice("notice-1");
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith("notice-1");
  });

  it("does nothing without an id", async () => {
    await cancelHoldExpiryNotice(null);
    expect(mocked.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it("swallows a failed withdrawal", async () => {
    mocked.cancelScheduledNotificationAsync.mockRejectedValue(new Error("gone"));
    await expect(cancelHoldExpiryNotice("notice-1")).resolves.toBeUndefined();
  });
});
