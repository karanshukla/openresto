import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Platform, useColorScheme as useSystemColorScheme } from "react-native";

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
  if (Platform.OS !== "web" || typeof localStorage === "undefined") return "system";
  return (localStorage.getItem(STORAGE_KEY) as ThemePreference) ?? "system";
}

function writeStorage(pref: ThemePreference) {
  if (Platform.OS !== "web" || typeof localStorage === "undefined") return;
  if (pref === "system") localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, pref);
}

function getSystemScheme(): ColorScheme {
  if (Platform.OS !== "web" || typeof window === "undefined") return "dark";
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStorage());
  const [systemScheme] = useState<ColorScheme>(getSystemScheme);

  const colorScheme: ColorScheme = preference === "system" ? systemScheme : preference;

  useEffect(() => {
    if (Platform.OS !== "web") return;

    if (colorScheme === "light") {
      document.body.classList.add("light");
    } else {
      document.body.classList.remove("light");
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
