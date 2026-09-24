import { Platform, StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

/** The search form is two fields and a button — it never earns more width than this. */
const FORM_COL_WIDTH = 400;
/** The result column takes the rest, up to a comfortable reading measure. */
const RESULT_COL_MAX_WIDTH = 560;
const COLUMN_GAP = 24;
/** How far below the top of the scroller either column pins, so the two line up once pinned. */
const PIN_TOP = theme.spacing.lg;
/** Room inside the result column's own scroller for the card's shadow, which it would clip. */
const SHADOW_ROOM = theme.spacing.md;

// Either column can be the long one — the form grows with the recent-bookings list — so both
// pin: scrolling past whichever is taller must not leave a column-height of empty space where
// the shorter one used to be.
const stickyOnWeb = Platform.OS === "web" ? ({ position: "sticky", top: PIN_TOP } as object) : null;

/**
 * Pins the result beside the form the way BookingDrawer sits beside the locations list. Two
 * things are needed, because `sticky` alone does nothing here. A booking is taller than the
 * viewport, so the column is capped at the scroller's visible height and scrolls inside. And
 * the result is the row's tallest child, which leaves a sticky box nowhere to go, so the row is
 * held to a viewport's height: the heading scrolls off and the columns pin beneath it. Nothing
 * may follow the row inside the scroller, or scrolling past it carries the column away — so
 * the row's floor stands in for the page's bottom padding, and LookupScreen moves the footer
 * below the scroller (as LocationsScreen does beside its drawer) and drops the scroll-to-top
 * rail, which a page that only scrolls by its heading has no use for.
 *
 * The column's padding and matching negative margin are room for the card's shadow, leaving
 * the card itself where it sat. Evaluated per render rather than at import because both sizes
 * come from a measured height.
 *
 * @see [LookupScreen.test.tsx](../../tests/components/booking/LookupScreen.test.tsx) — pins the
 * cap and the row's floor to the measured scroller on web, and both columns staying in the
 * page's flow off it.
 */
export function pinnedColumns(viewportHeight: number): {
  page: object | null;
  row: object | null;
  result: object | null;
} {
  if (Platform.OS !== "web" || viewportHeight <= 0) return { page: null, row: null, result: null };
  return {
    page: { paddingBottom: 0 },
    row: { minHeight: viewportHeight - PIN_TOP },
    result: {
      position: "sticky",
      top: PIN_TOP - SHADOW_ROOM,
      maxHeight: viewportHeight - 2 * (PIN_TOP - SHADOW_ROOM),
      overflowY: "auto",
      // SlidePanel's entrance slides in from the side, which would flash a horizontal scrollbar.
      overflowX: "hidden",
      padding: SHADOW_ROOM,
      margin: -SHADOW_ROOM,
    },
  };
}

export const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  // The page column caps at whatever the current layout needs, so the heading's left edge
  // always lines up with the search card beneath it. Heading treatment matches
  // /locations — left-aligned pageTitle over a muted body subtitle, no centred icon —
  // because these are sibling pages of the same site.
  page: { width: "100%", alignSelf: "center", gap: theme.spacing.lg },
  pageIdle: { maxWidth: FORM_COL_WIDTH },
  pageWide: { maxWidth: FORM_COL_WIDTH + COLUMN_GAP + RESULT_COL_MAX_WIDTH },
  header: { marginTop: theme.spacing.sm },
  waitlistTicket: { width: "100%", maxWidth: FORM_COL_WIDTH, marginBottom: theme.spacing.lg },
  // Idle: a single column the width of the search card — no result column is reserved
  // before there's a result to put in it.
  singleCol: { width: "100%", gap: theme.spacing.md },
  // Once a lookup runs, the form keeps its width and shifts left; the result takes the
  // rest. Both centre as a pair rather than splitting the page in half, so the form
  // doesn't balloon to twice the width it needs the moment a result arrives.
  wideRow: {
    flexDirection: "row",
    gap: COLUMN_GAP,
    alignItems: "flex-start",
    width: "100%",
  },
  formCol: { flexGrow: 0, flexShrink: 1, flexBasis: FORM_COL_WIDTH, ...stickyOnWeb },
  resultCol: { flex: 1, minWidth: 0 },
  searchCard: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    width: "100%",
    ...theme.shadows.md,
  },
  label: { ...theme.typography.label, letterSpacing: 0.2 },
  helpText: { ...theme.typography.caption, textAlign: "center", lineHeight: 18, marginTop: 4 },
  contactRow: { marginTop: -2 },
  msgCard: {
    borderRadius: theme.borderRadius.card,
    borderWidth: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    alignItems: "flex-start",
    ...theme.shadows.md,
  },
  msgRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  msgText: { ...theme.typography.body, flexShrink: 1 },
});
