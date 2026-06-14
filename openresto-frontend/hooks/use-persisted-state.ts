import { useState, useEffect } from "react";
import { Platform } from "react-native";

export function usePersistedState<T>(key: string, defaultValue: T): [T, (v: T) => void] {
  const [state, setState] = useState<T>(() => {
    if (Platform.OS !== "web") return defaultValue;
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (Platform.OS !== "web") return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // storage full or unavailable — ignore
    }
  }, [key, state]);

  return [state, setState];
}
