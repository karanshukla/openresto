import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Platform } from "react-native";
import { useColorScheme as useSystemColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";
export type ThemePreference = "light" | "dark" | "system";

interface ThemeContextValue {
  colorScheme: ColorScheme;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colorScheme: "light",
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

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useSystemColorScheme() ?? "light";
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPreferenceState(readStorage());
    setHydrated(true);
  }, []);

  const colorScheme: ColorScheme =
    !hydrated ? "light" :
    preference === "system" ? systemScheme :
    preference;

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
