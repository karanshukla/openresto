import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import type { PushRegistrationOptions, PushRegistrationResult } from "./pushRegistration";

export type { PushRegistrationOptions, PushRegistrationResult } from "./pushRegistration";

/** Must match the `channelId` the server sends; Android drops a message to an unknown channel. */
export const REMINDER_CHANNEL_ID = "booking-reminders";

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
  const id = extra?.eas?.projectId;
  return typeof id === "string" && id ? id : undefined;
}

/**
 * The native implementation: an Expo push token, minted against the EAS project the app was
 * built under. A simulator has no push service and a build with no project id has nowhere to
 * mint a token from, so both read as unsupported and the toggle never shows.
 *
 * @see [pushRegistration.native.test.ts](../tests/services/pushRegistration.native.test.ts)
 * — pins the simulator and missing-project-id cases, the Android channel, and the token shape.
 */
export function canRegisterForReminders(_options: PushRegistrationOptions): boolean {
  return Device.isDevice && projectId() !== undefined;
}

export async function registerForReminders(
  options: PushRegistrationOptions
): Promise<PushRegistrationResult> {
  if (!canRegisterForReminders(options)) return { status: "unsupported" };

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
