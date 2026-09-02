import { Platform } from "react-native";
import i18n from "@/i18n";
import { secondsUntilExpiryNotice } from "@/components/booking/holdCountdown";
import type { HoldExpiryNoticeId } from "./holdExpiryNotice";

export type { HoldExpiryNoticeId } from "./holdExpiryNotice";

/** Android drops a notification posted to a channel it has not been told about. */
export const HOLD_CHANNEL_ID = "table-holds";

/**
 * Loaded on demand for the same reason `pushRegistration.native.ts` does it: expo-notifications
 * throws on import under Expo Go, and a module-scope throw would take down the booking form
 * rather than merely skipping a warning.
 *
 * `require` and not `await import()` because Jest leaves a dynamic import as a real one and its
 * VM has no ESM loader; Metro defers both alike.
 */
function loadNotifications(): typeof import("expo-notifications") {
  // eslint-disable-next-line typescript/no-require-imports
  return require("expo-notifications");
}

/**
 * The native implementation. Every failure path — a refused prompt, a hold too short to warn
 * about, a notifications module that will not load — returns null, because a guest who cannot
 * be warned must still be able to book.
 *
 * @see [holdExpiryNotice.native.test.ts](../tests/services/holdExpiryNotice.native.test.ts)
 * — pins the refused prompt, the too-short hold, the Android channel, and that a throwing
 * module is swallowed.
 */
export async function scheduleHoldExpiryNotice(
  expiresAt: string
): Promise<HoldExpiryNoticeId | null> {
  const seconds = secondsUntilExpiryNotice(expiresAt);
  if (seconds === null) return null;

  try {
    const Notifications = loadNotifications();

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== "granted") return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(HOLD_CHANNEL_ID, {
        name: i18n.t("booking.hold.expiryNoticeChannel"),
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    // No response handler: the app is still mounted with the booking drawer open behind it, so
    // the tap that foregrounds it lands the guest exactly where the hold is.
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: i18n.t("booking.hold.expiryNoticeTitle"),
        body: i18n.t("booking.hold.expiryNoticeBody"),
        ...(Platform.OS === "android" ? { channelId: HOLD_CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
      },
    });
  } catch {
    return null;
  }
}

export async function cancelHoldExpiryNotice(id: HoldExpiryNoticeId | null): Promise<void> {
  if (!id) return;
  try {
    await loadNotifications().cancelScheduledNotificationAsync(id);
  } catch {
    // A warning we cannot withdraw is not worth failing a booking over.
  }
}
