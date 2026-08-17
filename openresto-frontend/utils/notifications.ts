import { theme } from "@/theme/theme";
import type { NotificationType } from "@/api/notifications";

/** Decodes a VAPID public key (base64url) into a Uint8Array for PushManager.subscribe. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

/** Encodes an ArrayBuffer to a base64 string (for push subscription keys). */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

export { relativeTime } from "@/utils/formatters";

/** Locale-aware booking date for notification meta lines. */
export function formatBookingDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const PAGE_SIZE = 20;
export const PIN_STORAGE_KEY = "openresto_pinned_notifs";

export const TYPE_LABELS: Record<NotificationType, string> = {
  BookingCreated: "New Booking",
  BookingCancelled: "Booking Cancelled",
  RestaurantNearlyFull: "Nearly Full",
};

type TypeIcon = {
  name: "checkmark-circle-outline" | "close-circle-outline" | "warning-outline";
  color: string;
};

export const TYPE_ICONS: Record<NotificationType, TypeIcon> = {
  BookingCreated: { name: "checkmark-circle-outline", color: theme.colors.success },
  BookingCancelled: { name: "close-circle-outline", color: theme.colors.error },
  RestaurantNearlyFull: { name: "warning-outline", color: theme.colors.warning },
};

export const TYPE_FILTERS = [
  { label: "All Types", value: "" },
  { label: "New Bookings", value: "BookingCreated" },
  { label: "Cancelled", value: "BookingCancelled" },
  { label: "Nearly Full", value: "RestaurantNearlyFull" },
];
