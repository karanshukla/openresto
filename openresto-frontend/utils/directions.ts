import { Linking, Platform } from "react-native";

export const GOOGLE_MAPS_SEARCH = "https://maps.google.com/?q=";
export const APPLE_MAPS_SEARCH = "https://maps.apple.com/?q=";

/**
 * The maps app the device already has. iOS hands a `maps.apple.com` link to the Maps app
 * without a round trip through the browser; Android does the same for `maps.google.com`.
 * Web keeps Google as the default and its callers offer both services side by side, since a
 * browser has no maps app of its own to prefer.
 *
 * @see [directions.test.ts](../tests/utils/directions.test.ts) — pins the platform split and
 * that the address is URL-encoded.
 */
export function directionsUrl(address: string, os: string = Platform.OS): string {
  const base = os === "ios" ? APPLE_MAPS_SEARCH : GOOGLE_MAPS_SEARCH;
  return `${base}${encodeURIComponent(address)}`;
}

export function openDirections(address: string): Promise<unknown> {
  return Linking.openURL(directionsUrl(address));
}
