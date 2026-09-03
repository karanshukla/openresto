import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { haptics } from "@/utils/haptics";

jest.mock("expo-haptics", () => ({
  ...jest.requireActual("expo-haptics"),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  performAndroidHapticsAsync: jest.fn().mockResolvedValue(undefined),
}));

const original = Platform.OS;

function runningOn(os: typeof Platform.OS) {
  Object.defineProperty(Platform, "OS", { value: os, configurable: true });
}

afterAll(() => runningOn(original));

beforeEach(() => jest.clearAllMocks());

// Android's `selectionAsync`/`impactAsync`/`notificationAsync` all drive `Vibrator`, which is
// the ringer motor rather than the haptic engine — a buzz where the same gesture on an iPhone
// is a tick. Every effect has to reach the platform's own haptic feedback instead.
describe("on Android", () => {
  beforeEach(() => runningOn("android"));

  it.each([
    ["selection", () => haptics.selection(), Haptics.AndroidHaptics.Segment_Tick],
    ["press", () => haptics.press(), Haptics.AndroidHaptics.Virtual_Key],
    ["success", () => haptics.outcome("success"), Haptics.AndroidHaptics.Confirm],
    ["warning", () => haptics.outcome("warning"), Haptics.AndroidHaptics.Reject],
    ["error", () => haptics.outcome("error"), Haptics.AndroidHaptics.Reject],
  ])("plays %s through the device's haptic engine", (_name, fire, expected) => {
    fire();
    expect(Haptics.performAndroidHapticsAsync).toHaveBeenCalledWith(expected);
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
  });

  // `HapticFeedbackConstants` grew Segment_Tick, Confirm and Reject in API 30, and the native
  // module rejects rather than degrading, so a phone below that must still feel something.
  it("falls back to a constant every supported Android has", async () => {
    (Haptics.performAndroidHapticsAsync as jest.Mock).mockRejectedValueOnce(
      new Error("unsupported")
    );
    haptics.selection();
    await Promise.resolve();
    await Promise.resolve();
    expect(Haptics.performAndroidHapticsAsync).toHaveBeenLastCalledWith(
      Haptics.AndroidHaptics.Clock_Tick
    );
  });

  it("gives up quietly when the fallback is refused too", async () => {
    (Haptics.performAndroidHapticsAsync as jest.Mock)
      .mockRejectedValueOnce(new Error("unsupported"))
      .mockRejectedValueOnce(new Error("no actuator"));
    expect(() => haptics.outcome("error")).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(Haptics.performAndroidHapticsAsync).toHaveBeenCalledTimes(2);
  });

  // Virtual_Key is available on every level this app builds for, so retrying it would only
  // put a second buzz on a device that already refused the first.
  it("does not retry an effect whose fallback is the constant that just failed", async () => {
    (Haptics.performAndroidHapticsAsync as jest.Mock).mockRejectedValueOnce(
      new Error("no actuator")
    );
    haptics.press();
    await Promise.resolve();
    await Promise.resolve();
    expect(Haptics.performAndroidHapticsAsync).toHaveBeenCalledTimes(1);
  });
});

describe("on iOS", () => {
  beforeEach(() => runningOn("ios"));

  it("plays a selection through the selection generator", () => {
    haptics.selection();
    expect(Haptics.selectionAsync).toHaveBeenCalled();
    expect(Haptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
  });

  it("plays a press as a light impact", () => {
    haptics.press();
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it.each([
    ["success", Haptics.NotificationFeedbackType.Success],
    ["warning", Haptics.NotificationFeedbackType.Warning],
    ["error", Haptics.NotificationFeedbackType.Error],
  ] as const)("reports a %s outcome as its notification type", (outcome, expected) => {
    haptics.outcome(outcome);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith(expected);
  });

  it("does not throw when the device has no haptic engine", () => {
    (Haptics.selectionAsync as jest.Mock).mockRejectedValueOnce(new Error("unavailable"));
    expect(() => haptics.selection()).not.toThrow();
  });
});

// The web implementation already drives navigator.vibrate where it exists and Safari's
// switch trick where it does not, so web keeps the cross-platform calls.
describe("on web", () => {
  beforeEach(() => runningOn("web"));

  it("keeps the cross-platform calls", () => {
    haptics.selection();
    haptics.press();
    expect(Haptics.selectionAsync).toHaveBeenCalled();
    expect(Haptics.impactAsync).toHaveBeenCalled();
    expect(Haptics.performAndroidHapticsAsync).not.toHaveBeenCalled();
  });
});
