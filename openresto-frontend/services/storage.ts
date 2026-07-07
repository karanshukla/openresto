import { Platform } from "react-native";

// Thin abstraction over synchronous web storage (localStorage on web, no-op on
// native). Centralizes the Platform guard + try/catch so usePersistedState and
// ThemeContext share one implementation rather than each inlining the same
// `Platform.OS === "web"` + localStorage-access boilerplate.
//
// String-level API (matches localStorage's native interface); callers own JSON
// serialization. Native can later swap to AsyncStorage by providing a different
// implementation behind this same shape.
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
