import { Platform } from "react-native";
import { configuredApiUrl } from "@/api/client";

/**
 * Makes a server-relative URL loadable off web.
 *
 * The API hands out uploaded media as paths (`/media/location-3.jpg?v=…`, `/media/menu-3.pdf`)
 * because on web the browser resolves them against the page's own origin, which is also the
 * server's. A native app has no page origin: expo-image cannot fetch `/media/…` and
 * `Linking.openURL` refuses it. Off web the path is joined onto the server the build was
 * pointed at, which is the API base minus its `/api` segment — the same host nginx serves
 * `/media/` from. Absolute URLs (an external menu link, a data URI) pass through untouched,
 * and on web every input comes back exactly as given.
 *
 * @see [serverUrl.test.ts](../tests/utils/serverUrl.test.ts) — pins that web is a pass-through,
 * that a relative path joins the server root, and that an absolute URL is left alone.
 */
export function resolveServerUrl(url: string): string {
  if (Platform.OS === "web" || !url.startsWith("/") || url.startsWith("//")) return url;

  const api = configuredApiUrl();
  if (!api) return url;

  const root = api.replace(/\/+$/, "").replace(/\/api$/i, "");
  return `${root}${url}`;
}
