import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/** What a haptic is reporting, rather than how strong it is. */
export type HapticOutcome = "success" | "warning" | "error";

/**
 * The Android constant each effect asks for, and the one to settle for.
 *
 * `HapticFeedbackConstants` grew most of its expressive values in API 30, and
 * `performAndroidHapticsAsync` rejects outright on a device whose platform lacks the constant
 * named. Every fallback here has existed since API 24 — the floor an Expo build targets — so an
 * older phone gets a coarser tick instead of an unhandled rejection.
 */
const ANDROID_EFFECTS = {
  selection: [Haptics.AndroidHaptics.Segment_Tick, Haptics.AndroidHaptics.Clock_Tick],
  press: [Haptics.AndroidHaptics.Virtual_Key, Haptics.AndroidHaptics.Virtual_Key],
  success: [Haptics.AndroidHaptics.Confirm, Haptics.AndroidHaptics.Virtual_Key],
  warning: [Haptics.AndroidHaptics.Reject, Haptics.AndroidHaptics.Long_Press],
  error: [Haptics.AndroidHaptics.Reject, Haptics.AndroidHaptics.Long_Press],
} as const satisfies Record<string, readonly [Haptics.AndroidHaptics, Haptics.AndroidHaptics]>;

type AndroidEffect = keyof typeof ANDROID_EFFECTS;

/**
 * Feedback is the last thing that may take a screen down with it, so every path here swallows
 * its own failure: a phone with no actuator, a permission the OS declines, a constant the
 * platform never had.
 */
function performAndroid(effect: AndroidEffect): void {
  const [preferred, fallback] = ANDROID_EFFECTS[effect];
  Haptics.performAndroidHapticsAsync(preferred).catch(() => {
    if (fallback === preferred) return;
    Haptics.performAndroidHapticsAsync(fallback).catch(() => {});
  });
}

function attempt(run: () => Promise<void>): void {
  run().catch(() => {});
}

/**
 * The app's haptic vocabulary, in three effects, so a call site names what happened rather
 * than which platform API to reach for.
 *
 * The split exists because `expo-haptics`' cross-platform trio — `selectionAsync`,
 * `impactAsync`, `notificationAsync` — is only haptics on iOS. On Android all three drive
 * `Vibrator.vibrate(createWaveform(...))`, a 43–60 ms burst of the ringer motor: audibly a
 * buzz, not a tick, and nothing like the same gesture on an iPhone. Expo's own guidance is to
 * use `performAndroidHapticsAsync`, which calls `View.performHapticFeedback` and so goes
 * through the system's haptic composition — the same path the keyboard and the platform's own
 * controls use, and one that respects the device's touch-feedback setting.
 *
 * Web keeps the cross-platform calls: `expo-haptics`' web implementation already drives
 * `navigator.vibrate` where it exists and Safari's switch trick where it does not.
 *
 * @see [haptics.test.ts](../tests/utils/haptics.test.ts) — pins that Android routes every
 * effect through `performAndroidHapticsAsync` and iOS through the impact/selection/notification
 * generators, and that an unsupported Android constant falls back rather than rejecting.
 */
export const haptics = {
  /** Moving between discrete choices: a slot, a row, a party size, a panel opening or closing. */
  selection(): void {
    if (Platform.OS === "android") return performAndroid("selection");
    attempt(() => Haptics.selectionAsync());
  },

  /** A press landing on a control. */
  press(): void {
    if (Platform.OS === "android") return performAndroid("press");
    attempt(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },

  /** The result of something the guest asked for: a booking made, a lookup that found nothing. */
  outcome(outcome: HapticOutcome): void {
    if (Platform.OS === "android") return performAndroid(outcome);
    attempt(() =>
      Haptics.notificationAsync(
        outcome === "error"
          ? Haptics.NotificationFeedbackType.Error
          : outcome === "warning"
            ? Haptics.NotificationFeedbackType.Warning
            : Haptics.NotificationFeedbackType.Success
      )
    );
  },
};

export default haptics;
