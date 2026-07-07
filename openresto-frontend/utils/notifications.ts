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

/** Compact relative timestamp: "just now", "5m ago", "3h ago", "2d ago". */
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

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
