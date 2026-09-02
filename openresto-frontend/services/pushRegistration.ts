import type { ReminderRegistration } from "@/api/reminders";
import { arrayBufferToBase64, urlBase64ToUint8Array } from "@/utils/notifications";

export type PushRegistrationResult =
  | { status: "registered"; registration: ReminderRegistration }
  | { status: "denied" }
  | { status: "unsupported" };

export interface PushRegistrationOptions {
  /** The server's VAPID public key; web cannot subscribe without one. Ignored on native. */
  webPushPublicKey?: string;
}

/**
 * Whether this platform can register for reminders at all, decided without prompting: the
 * toggle stays hidden when the answer is no rather than offering a control that cannot work.
 *
 * This file is the **web** implementation over the Push API; native resolves the sibling
 * `pushRegistration.native.ts` (expo-notifications) through Metro's platform extensions, which
 * keeps that module and its native bindings out of the web bundle.
 *
 * @see [pushRegistration.test.ts](../tests/services/pushRegistration.test.ts) — pins that a
 * missing key or PushManager reads as unsupported and a refused prompt as denied.
 */
export function canRegisterForReminders(options: PushRegistrationOptions): boolean {
  return (
    Boolean(options.webPushPublicKey) &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator
  );
}

export async function registerForReminders(
  options: PushRegistrationOptions
): Promise<PushRegistrationResult> {
  if (!canRegisterForReminders(options)) return { status: "unsupported" };

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { status: "denied" };

  const worker = await navigator.serviceWorker.ready;
  const existing = await worker.pushManager.getSubscription();
  const sub =
    existing ??
    (await worker.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(options.webPushPublicKey!),
    }));

  return {
    status: "registered",
    registration: {
      channel: "webpush",
      endpoint: sub.endpoint,
      p256dh: arrayBufferToBase64(sub.getKey("p256dh")!),
      auth: arrayBufferToBase64(sub.getKey("auth")!),
    },
  };
}
