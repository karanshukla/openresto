import { useLayoutEffect } from "react";
import { Platform } from "react-native";
import { UnistylesRuntime } from "react-native-unistyles";
import { useTheme } from "@/context/ThemeContext";
import { useBrand } from "@/context/BrandContext";
import { theme } from "@/theme/theme";

/**
 * react-native-web appends its own `<style id="react-native-stylesheet">` reset
 * during bundle init, which lands *after* the `<style id="unistyles-web">` that
 * static rendering wrote into <head>. Both sides use single-class selectors, so
 * RNW's base `.css-*` reset (flex-direction: column, padding: 0, transparent
 * background, border: 0) silently wins over every Unistyles rule it also
 * declares. Re-appending the Unistyles tag puts it last in the cascade.
 */
function moveUnistylesStylesLast() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;

  const tag = document.getElementById("unistyles-web");
  if (tag && tag.parentNode === document.head) {
    document.head.appendChild(tag);
  }
}

/**
 * Unistyles spike (issue #219) — keeps the Unistyles runtime in step with the
 * two pieces of state the bespoke system owns today:
 *
 *  1. `ThemeContext.colorScheme` (light/dark/system preference + persistence)
 *  2. `BrandContext.primaryColor`, fetched from `/api/brand` after mount
 *
 * (2) is the interesting one: the brand accent isn't known at configure time,
 * so it can't be a static token. `updateTheme` patches it into both themes
 * once it arrives, which is how a full migration would keep `primaryColor`
 * usable as `theme.colors.primary` inside `StyleSheet.create`.
 */
export function useUnistylesBridge() {
  const { colorScheme } = useTheme();
  const { primaryColor } = useBrand();

  useLayoutEffect(() => {
    moveUnistylesStylesLast();
  }, []);

  useLayoutEffect(() => {
    UnistylesRuntime.setTheme(colorScheme);
  }, [colorScheme]);

  useLayoutEffect(() => {
    const accent = primaryColor || theme.colors.primary;

    for (const name of ["light", "dark"] as const) {
      UnistylesRuntime.updateTheme(name, (current) => ({
        ...current,
        colors: { ...current.colors, primary: accent },
      }));
    }
  }, [primaryColor]);
}
