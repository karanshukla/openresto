import { useState, useEffect, type Dispatch, type SetStateAction } from "react";
import { StorageService } from "@/services/storage";

export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    const stored = StorageService.getItem(key);
    try {
      return stored !== null ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    StorageService.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState];
}
