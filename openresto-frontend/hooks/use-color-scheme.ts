import { useTheme } from "@/context/ThemeContext";

/**
 * The scheme the app is rendering in: the visitor's own light/dark pick when they have made
 * one, and the device's only while their preference is "system".
 *
 * This deliberately does not read React Native's `useColorScheme`, which answers for the
 * device and nothing else. Reading it left the native build ignoring the in-app theme picker
 * outright — `ThemeContext` recorded the pick and every colour still came from the phone —
 * and disagreeing with `ThemeContext` on the default besides, since RN reports `null` for a
 * device that declares no scheme and `ThemeContext` treats undeclared as dark. `ThemeContext`
 * already resolves the system scheme per platform (`Appearance` off web, `prefers-color-scheme`
 * on it), so there is one answer here rather than a platform split.
 *
 * @see [use-color-scheme.test.ts](../tests/hooks/use-color-scheme.test.ts) — pins that an
 * explicit pick wins over the device, on native as well as web.
 */
export function useColorScheme() {
  const { colorScheme } = useTheme();
  return colorScheme;
}
