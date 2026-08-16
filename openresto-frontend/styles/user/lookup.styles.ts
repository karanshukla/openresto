import { Platform, StyleSheet } from "react-native";
import { theme } from "@/theme/theme";

/** The search form is two fields and a button — it never earns more width than this. */
const FORM_COL_WIDTH = 400;
/** The result column takes the rest, up to a comfortable reading measure. */
const RESULT_COL_MAX_WIDTH = 560;
const COLUMN_GAP = 24;

// The form is short and the result is long, so on wide layouts the form column sticks
// while the result scrolls past it — otherwise scrolling down the booking leaves a
// column-height of empty space where the form used to be.
const stickyOnWeb = Platform.OS === "web" ? ({ position: "sticky", top: 0 } as object) : null;

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
  header: { gap: theme.spacing.xxs, marginTop: theme.spacing.sm },
  title: { ...theme.typography.pageTitle, lineHeight: 38 },
  subtitle: { ...theme.typography.body },
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
