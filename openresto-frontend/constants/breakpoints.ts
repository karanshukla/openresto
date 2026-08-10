/**
 * Viewport breakpoints, in dp.
 *
 * These existed as bare numbers scattered across screens and drifted apart: the
 * booking form and PageContainer split at 768 while the home page and the
 * scroll-to-top FAB split at 700, so a 720px-wide window got the mobile
 * container padding with a desktop hero. Import from here instead of writing a
 * literal, and the whole app changes together.
 */
export const BREAKPOINTS = {
  /**
   * Phone-ish. Below this, side-by-side layouts stack and screens use their
   * compact padding. Note that `Platform.OS === "web"` is true on a phone
   * browser, so a layout that only makes sense on a real desktop must check
   * width as well as (or instead of) platform.
   */
  mobile: 768,
} as const;

export const MOBILE_BREAKPOINT = BREAKPOINTS.mobile;

/** True when the viewport is narrower than the phone breakpoint. */
export function isMobileWidth(width: number): boolean {
  return width < MOBILE_BREAKPOINT;
}
