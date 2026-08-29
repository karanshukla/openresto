import { Platform } from "react-native";
import { buildUrl } from "@/api/client";

/**
 * The API's absolute base, for showing someone a request they can paste into a terminal.
 *
 * `buildUrl` answers what `fetch` needs, which under nginx is the relative `/api` — correct for
 * a request the browser resolves against its own page, useless in a curl example. The browser's
 * origin fills that gap; off web there is no window to ask, so the caller passes one (the
 * brand's configured website URL) and a relative base is what's left when even that is unset.
 *
 * @see [apiBaseUrl.test.ts](../tests/utils/apiBaseUrl.test.ts) — pins that an absolute
 * `EXPO_PUBLIC_API_URL` is returned untouched and a relative one is resolved against an origin.
 */
export function apiBaseUrl(fallbackOrigin?: string): string {
  const base = buildUrl("");
  if (/^https?:\/\//i.test(base)) return base;

  const origin =
    Platform.OS === "web" && typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : fallbackOrigin;

  return origin ? `${origin.replace(/\/+$/, "")}${base}` : base;
}
