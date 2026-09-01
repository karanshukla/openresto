import { Platform } from "react-native";

/**
 * Synchronous key/value storage, string in and string out (localStorage's own shape), so
 * `usePersistedState`, `ThemeContext` and `LocaleContext` can read a persisted value during
 * their initial render rather than flashing a default and correcting it. Callers own JSON
 * serialization.
 *
 * This file is the **web** implementation and backs onto `localStorage`; native resolves the
 * sibling `storage.native.ts` (expo-sqlite's key-value store) through Metro's platform
 * extensions. The split is what keeps `expo-sqlite` — and the wasm build it would pull in on
 * web — out of the web bundle entirely.
 *
 * Every access is swallowed: storage can be full, disabled by the viewer, or unavailable in a
 * private window, and none of those are worth failing a render over.
 *
 * @see [storage.test.ts](../tests/services/storage.test.ts) — pins that a throwing
 * localStorage reads back as `null` rather than propagating.
 * @see [storage.native.test.ts](../tests/services/storage.native.test.ts) — pins that the
 * native implementation keeps the same swallowing semantics over the kv-store.
 */
export const StorageService = {
  getItem(key: string): string | null {
    if (Platform.OS !== "web" || typeof localStorage === "undefined") return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    if (Platform.OS !== "web" || typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // storage full or unavailable — ignore (mirrors prior usePersistedState behavior)
    }
  },

  removeItem(key: string): void {
    if (Platform.OS !== "web" || typeof localStorage === "undefined") return;
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};
