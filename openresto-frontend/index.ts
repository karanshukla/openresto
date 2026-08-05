/**
 * App entry point (see `main` in package.json).
 *
 * Unistyles must be configured before any module calls `StyleSheet.create`,
 * which rules out configuring it from inside `app/_layout.tsx` — Expo Router
 * has already imported every route by then.
 */
import "./theme/unistyles";
import "expo-router/entry";
