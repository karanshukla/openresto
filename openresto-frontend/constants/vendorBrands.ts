/**
 * Colours belonging to the outside services we hand a diner off to. Deliberately not in
 * `theme`: these are somebody else's brand, fixed regardless of what the restaurant sets its
 * own `primaryColor` to, and a pill wearing one is a signpost off this app rather than an
 * action within it.
 *
 * One value per vendor, not a light/dark pair, because a pill spends its brand colour on the
 * outline and the glyph only — both UI components, which WCAG 1.4.11 asks 3:1 of, and which
 * these clear against the card in either theme. The label keeps the theme's reading colour;
 * hand it a brand blue and the bar becomes 4.5:1, which is what forces the darker
 * product-UI tints that don't look like anyone's logo.
 *
 * Apple is absent on purpose: its identity guidelines say never to alter the mark, so an
 * Apple pill takes the neutral tone rather than a colour of its own.
 */
export const VENDOR_BRANDS = {
  /** Google's brand blue — the blue of the "G", not the darker blue-600 of Google's own UI. */
  google: "#4285f4",
  /** Microsoft's communication blue, the flat blue behind the Outlook icon's gradient. */
  microsoft: "#0078d4",
} as const;

export type VendorBrand = keyof typeof VENDOR_BRANDS;
