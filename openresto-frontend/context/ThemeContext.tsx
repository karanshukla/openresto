import { createContext, useContext, useLayoutEffect, useState, ReactNode } from "react";
import { Platform } from "react-native";
import { StorageService } from "@/services/storage";

export type ColorScheme = "light" | "dark";
export type ThemePreference = "light" | "dark" | "system";

interface ThemeContextValue {
  colorScheme: ColorScheme;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colorScheme: "dark",
  preference: "system",
  setPreference: () => {},
  toggle: () => {},
});

const STORAGE_KEY = "openresto-theme";

function readStorage(): ThemePreference {
  return (StorageService.getItem(STORAGE_KEY) as ThemePreference) ?? "system";
}

function writeStorage(pref: ThemePreference) {
  if (pref === "system") StorageService.removeItem(STORAGE_KEY);
  else StorageService.setItem(STORAGE_KEY, pref);
}

function getSystemScheme(): ColorScheme {
  if (Platform.OS !== "web" || typeof window === "undefined") return "dark";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(scheme: ColorScheme) {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const bg = scheme === "dark" ? "#111214" : "#f2f3f5";
  document.documentElement.className = scheme;
  document.documentElement.style.backgroundColor = bg;
  document.body.className =
    document.body.className.replace(/\b(light|dark)\b/g, "").trim() + " " + scheme;
  document.body.style.backgroundColor = bg;
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStorage());
  const [systemScheme] = useState<ColorScheme>(getSystemScheme);
  const colorScheme: ColorScheme = preference === "system" ? systemScheme : preference;

  // useLayoutEffect fires BEFORE paint — no flash
  useLayoutEffect(() => {
    applyTheme(colorScheme);

    if (!document.body.classList.contains("theme-ready")) {
      requestAnimationFrame(() => {
        document.body.classList.add("theme-ready");
      });
    }
  }, [colorScheme]);

  const setPreference = (pref: ThemePreference) => {
    setPreferenceState(pref);
    writeStorage(pref);
  };

  const toggle = () => setPreference(colorScheme === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ colorScheme, preference, setPreference, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
