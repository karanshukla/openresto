/**
 * Single home for hardcoded default/fallback UI copy — strings the app substitutes when an
 * admin-authored field is null or empty (a brand highlights heading, a hero subtitle) or that
 * are duplicated verbatim between the real home page and its admin preview mirror. Importing
 * from here instead of retyping the string is what keeps those pairs from drifting, and gives
 * future i18n extraction (#372-#374) exactly one key per piece of copy instead of one per
 * call site.
 *
 * This file is deliberately narrow: plain UI labels that happen to repeat across unrelated
 * components (nav titles, "Cancel"/"Save"-style action words, form placeholders) are not
 * default/fallback copy and do not belong here — they become `common.*`-style keys in the
 * i18n extraction tickets themselves, not a constants indirection invented ahead of them.
 */
export const DEFAULT_COPY = {
  // Home page hero + highlights fallbacks, shown until the matching brand field is set.
  // Shared with BrandPreview so the admin's live preview can never drift from the real page.
  highlightsHeading: "Restaurant highlights",
  highlightsSubheading: "Curated by the owner",
  heroSubtitle:
    "Scroll down to pick a location below, choose a time, enter your email address, and you're booked!",
  // Plain (non-fallback) copy shared with BrandPreview for the same reason: the preview is a
  // miniature of this exact page, and the two used to carry two hand-typed copies of it.
  locationsSectionHeading: "Our locations",

  // LoadingScreen's default message, shown whenever no caller-specific message is passed.
  loadingMessage: "Preparing your table...",
} as const;
