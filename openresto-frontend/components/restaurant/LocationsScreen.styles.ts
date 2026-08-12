import { StyleSheet, Platform } from "react-native";
import { theme } from "@/theme/theme";

export const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingRoot: { flex: 1, alignItems: "center", justifyContent: "center" },
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
    maxWidth: 820,
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
  // The bar states the question every card below it is answering, so it stays pinned to
  // the top of the list rather than scrolling away from its own answers. Two details it
  // can't do without: the explicit zIndex, because react-native-web stamps `zIndex: 0` on
  // every View and a later sibling would otherwise paint straight over the pinned bar;
  // and the page-coloured band (set at the call site, where the theme is), which fills
  // the bar's rounded corners so cards don't show through them on the way past.
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
