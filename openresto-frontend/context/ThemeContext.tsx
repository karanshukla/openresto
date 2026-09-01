import { createContext, useContext, useEffect, useLayoutEffect, useState, ReactNode } from "react";
import { Appearance, Platform } from "react-native";
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

/** Anything the OS does not declare as light — including its "unspecified" — keeps the dark default. */
function fromDevice(scheme: ReturnType<typeof Appearance.getColorScheme>): ColorScheme {
  return scheme === "light" ? "light" : "dark";
}

/**
 * The scheme the device itself is set to. Off web that is `Appearance`, the OS setting an
 * installed app is expected to follow; on web it stays the `prefers-color-scheme` media query
 * the PWA has always read.
 *
 * @see [ThemeContext.native.test.tsx](../tests/context/ThemeContext.native.test.tsx) — pins
 * that a device set to light renders light, and that an undeclared device scheme keeps the
 * dark default.
 */
function getSystemScheme(): ColorScheme {
  if (Platform.OS !== "web") return fromDevice(Appearance.getColorScheme());
  /* istanbul ignore next -- the static web export prerenders on Node, which has no window; every test runs under jsdom */
  if (typeof window === "undefined") return "dark";
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
  const [systemScheme, setSystemScheme] = useState<ColorScheme>(getSystemScheme);
  const colorScheme: ColorScheme = preference === "system" ? systemScheme : preference;

  // Only while the device is the one choosing: a phone that switches to dark at sunset moves
  // the app with it, and an explicit light/dark pick keeps overriding it. Re-reading on
  // subscribe catches a switch that happened while the app was following an explicit pick.
  useEffect(() => {
    if (Platform.OS === "web" || preference !== "system") return;
    setSystemScheme(getSystemScheme());
    const subscription = Appearance.addChangeListener(({ colorScheme: next }) =>
      setSystemScheme(fromDevice(next))
    );
    return () => subscription.remove();
  }, [preference]);

  // useLayoutEffect fires BEFORE paint — no flash
  useLayoutEffect(() => {
    applyTheme(colorScheme);

    if (Platform.OS !== "web" || typeof document === "undefined") return;
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
