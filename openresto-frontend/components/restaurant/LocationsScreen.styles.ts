import { StyleSheet, Platform } from "react-native";
import { theme } from "@/theme/theme";

/**
 * The list's own column, narrower than PageContainer's default. The sticky band mirrors it
 * from outside the column, so the two have to read from one value or the pinned controls
 * drift off the cards below them.
 */
export const PAGE_MAX_WIDTH = 820;

export const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.lg,
    padding: theme.spacing.xxl,
  },
  row: {
    flex: 1,
    flexDirection: "row",
    width: "100%",
    // react-native-web needs the explicit min-height:0 for the list column to shrink
    // instead of overflowing once the drawer takes its 460px beside it.
    // Widening this row is not animatable and no transition belongs here: the cap goes
    // from `none` to a pixel value, which CSS cannot interpolate, and global.css's
    // `* { transition: none !important }` would kill the rule regardless.
    ...(Platform.OS === "web" ? ({ minHeight: 0 } as object) : null),
  },
  rowWithDrawer: {
    alignSelf: "center",
  },
  listColumn: {
    flex: 1,
    minWidth: 0,
  },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  page: {
    maxWidth: PAGE_MAX_WIDTH,
    gap: theme.spacing.lg,
  },
  header: {
    gap: theme.spacing.xxs,
  },
  title: {
    ...theme.typography.pageTitle,
    lineHeight: 38,
  },
  subtitle: {
    ...theme.typography.body,
  },
  // The explicit zIndex is required: react-native-web stamps `zIndex: 0` on every View
  // and a later sibling would otherwise paint straight over the pinned bar.
  filterSticky: {
    zIndex: 5,
    // Both paddings are cancelled by matching negative margins: the band only exists once
    // the bar is pinned, and at rest the list should sit exactly where it did before. The
    // top half is what keeps the pinned bar off the navbar's underside instead of welded
    // to it, and it hides the cards passing through that gap.
    paddingTop: theme.spacing.md,
    marginTop: -theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    marginBottom: -(theme.spacing.sm + 1),
    // Always present and transparent so pinning only changes the colour: a border that
    // appeared with the pin would push the whole list down a pixel as it landed.
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
    ...(Platform.OS === "web" ? ({ position: "sticky", top: 0 } as object) : null),
  },
  /**
   * Pinned, the band is page chrome and runs the full width of the viewport, matching the
   * navbar directly above it. It lives inside the page's content column, so it has to break
   * out of one: `100vw` plus the centring margin is the standard full-bleed escape.
   *
   * Applied together with `filterBandInner`, and only when `LocationsScreen` decides the band
   * may bleed. Never on native, where `position: sticky` doesn't apply either, and never
   * while the booking drawer is open, since the list column is then narrower than the
   * viewport and a viewport-wide band would run on underneath the drawer.
   */
  filterBleed: {
    width: "100vw",
    marginLeft: "calc(50% - 50vw)",
    marginRight: "calc(50% - 50vw)",
  } as object,
  /**
   * Puts the content column back inside a bled band so the controls stay over the cards.
   * The padding mirrors PageContainer's, which is what the cards below are inset by.
   */
  filterBandInner: {
    width: "100%",
    maxWidth: PAGE_MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: theme.spacing.xxl,
  },
  filterBandInnerCompact: {
    paddingHorizontal: theme.spacing.lg,
  },
  list: {
    gap: theme.spacing.md,
  },
  empty: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    fontStyle: "italic",
  },
});
