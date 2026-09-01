import Storage from "expo-sqlite/kv-store";

/**
 * Native counterpart to `storage.ts`. Metro resolves this file on ios/android and the plain
 * one on web, so the two never coexist in a bundle.
 *
 * `expo-sqlite/kv-store` is the one persistent store that offers a *synchronous* read
 * (`getItemSync`), which is what the shape of this service requires — `usePersistedState`,
 * `ThemeContext` and `LocaleContext` all resolve their initial value inside a `useState`
 * initializer, and an async store would make every one of them render the default first.
 *
 * @see [storage.native.test.ts](../tests/services/storage.native.test.ts) — pins the
 * kv-store round trip and that a throwing store reads back as `null`.
 */
export const StorageService = {
  getItem(key: string): string | null {
    try {
      return Storage.getItemSync(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      Storage.setItemSync(key, value);
    } catch {
      // store unavailable or out of disk — ignore, same as the web side
    }
  },

  removeItem(key: string): void {
    try {
      Storage.removeItemSync(key);
    } catch {
      // ignore
    }
  },
};
