import { Linking, Platform } from "react-native";

/**
 * Hands a URL to whatever owns it outside the app: a new browser tab on web, the OS's own
 * handler (browser, or the installed app that claims the link) on native.
 *
 * `window.open` is not a no-op on native — `window` exists in React Native but has no `open`,
 * so the web form throws rather than silently doing nothing, which is why every outward link
 * goes through here rather than inlining the split.
 *
 * @see [openExternal.test.ts](../tests/utils/openExternal.test.ts) — pins the new tab on web
 * and `Linking.openURL` on native.
 */
export function openExternal(url: string): void {
  if (Platform.OS === "web") {
    window.open(url, "_blank");
    return;
  }
  void Linking.openURL(url);
}
