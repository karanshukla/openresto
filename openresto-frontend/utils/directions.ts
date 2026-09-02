import { Linking, Platform } from "react-native";

export const GOOGLE_MAPS_SEARCH = "https://maps.google.com/?q=";
export const APPLE_MAPS_SEARCH = "https://maps.apple.com/?q=";
/** Apple's own scheme, which opens the Maps app directly rather than a Safari page first. */
export const APPLE_MAPS_SCHEME = "maps://?q=";
/** Android's geo intent, answered by whichever maps app the phone has, with no browser hop. */
export const ANDROID_GEO_SCHEME = "geo:0,0?q=";

/**
 * A maps link for the platform. Web gets a page, since a browser has no maps app to prefer
 * (its callers offer Google and Apple side by side). A phone gets its own scheme: an https
 * link opened from inside an app lands in the browser first and only sometimes hands on to
 * Maps, which is the "directions don't work" a guest sees.
 *
 * @see [directions.test.ts](../tests/utils/directions.test.ts) — pins the URL per platform
 * and that the address is URL-encoded.
 */
export function directionsUrl(address: string, os: string = Platform.OS): string {
  const query = encodeURIComponent(address);
  if (os === "ios") return `${APPLE_MAPS_SCHEME}${query}`;
  if (os === "android") return `${ANDROID_GEO_SCHEME}${query}`;
  return `${GOOGLE_MAPS_SEARCH}${query}`;
}

/**
 * The page a phone falls back to when nothing answers its scheme — a device with no maps
 * app at all, or an emulator.
 */
export function directionsFallbackUrl(address: string, os: string = Platform.OS): string {
  const query = encodeURIComponent(address);
  return os === "ios" ? `${APPLE_MAPS_SEARCH}${query}` : `${GOOGLE_MAPS_SEARCH}${query}`;
}

/**
 * @see [directions.test.ts](../tests/utils/directions.test.ts) — pins the fallback to the
 * https page when the scheme is refused.
 */
export function openDirections(address: string): Promise<unknown> {
  return Linking.openURL(directionsUrl(address)).catch(() =>
    Linking.openURL(directionsFallbackUrl(address))
  );
}
