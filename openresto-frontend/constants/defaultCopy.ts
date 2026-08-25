/**
 * Single home for hardcoded default/fallback UI copy that is deliberately NOT run through
 * i18next. The home hero/highlights/locations fallbacks this file used to hold moved to
 * `locales/*.json` (`restaurant.home.*`) in #372 — that extraction is the proof the i18n
 * pipeline works end to end, so a duplicated pair of literal strings is no longer the
 * drift-guard for those; `tests/i18n/parity.test.ts` is.
 *
 * What's left is `loadingMessage`: `LoadingScreen` renders before `/api/brand` resolves, so
 * before any locale is known, and stays hardcoded English on purpose rather than growing a
 * device-locale special case for one string.
 */
export const DEFAULT_COPY = {
  loadingMessage: "Preparing your table...",
} as const;
