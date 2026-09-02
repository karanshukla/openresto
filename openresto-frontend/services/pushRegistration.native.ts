import { Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";
import * as Device from "expo-device";
import type { PushRegistrationOptions, PushRegistrationResult } from "./pushRegistration";

export type { PushRegistrationOptions, PushRegistrationResult } from "./pushRegistration";

/** Must match the `channelId` the server sends; Android drops a message to an unknown channel. */
export const REMINDER_CHANNEL_ID = "booking-reminders";

/**
 * Loaded on demand rather than at module scope: expo-notifications throws on import under Expo
 * Go, which SDK 53 dropped remote push from, and a module-scope throw takes down every route
 * that reaches the booking card instead of merely hiding the toggle. `canRegisterForReminders`
 * is what keeps this call off the Expo Go path.
 *
 * `require` and not `await import()` because Jest leaves a dynamic import as a real one and its
 * VM has no ESM loader; Metro defers both alike.
 */
function loadNotifications(): typeof import("expo-notifications") {
  // eslint-disable-next-line typescript/no-require-imports
  return require("expo-notifications");
}

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
  const id = extra?.eas?.projectId;
  return typeof id === "string" && id ? id : undefined;
}

/**
 * The native implementation: an Expo push token, minted against the EAS project the app was
 * built under. A simulator has no push service, a build with no project id has nowhere to mint
 * a token from, and Expo Go dropped remote push in SDK 53, so all three read as unsupported and
 * the toggle never shows.
 *
 * @see [pushRegistration.native.test.ts](../tests/services/pushRegistration.native.test.ts)
 * — pins the simulator, Expo Go and missing-project-id cases, the Android channel, and the
 * token shape.
 */
export function canRegisterForReminders(_options: PushRegistrationOptions): boolean {
  return Device.isDevice && !isRunningInExpoGo() && projectId() !== undefined;
}

export async function registerForReminders(
  options: PushRegistrationOptions
): Promise<PushRegistrationResult> {
  if (!canRegisterForReminders(options)) return { status: "unsupported" };

  const Notifications = loadNotifications();

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: "Booking reminders",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== "granted") return { status: "denied" };

  const token = await Notifications.getExpoPushTokenAsync({ projectId: projectId()! });
  return { status: "registered", registration: { channel: "expo", endpoint: token.data } };
}
