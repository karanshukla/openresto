import { StyleSheet, Platform } from "react-native";
import { theme } from "@/theme/theme";
import type { RgbColor } from "@/utils/colors";

/**
 * The mask behind the pinned filter pill: the page colour under the pill, fading out over the
 * band's bottom padding. Solid to the pill's lower edge is what stops cards appearing in the
 * gap above it, and fading rather than stopping is what keeps the band from reading as a
 * square header around a rounded pill — the shape this page had before.
 *
 * The last stop is the page colour at zero alpha, not `transparent`: Safari resolves the
 * keyword to transparent *black*, which greys the fade on a light page.
 */
export function pinnedMask({ r, g, b }: RgbColor): object {
  const page = `rgba(${r},${g},${b},1)`;
  return {
    backgroundImage: `linear-gradient(to bottom, ${page} 0, ${page} calc(100% - ${theme.spacing.md}px), rgba(${r},${g},${b},0) 100%)`,
  };
}

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
    maxWidth: 820,
    gap: theme.spacing.lg,
  },
  // The explicit zIndex is required: react-native-web stamps `zIndex: 0` on every View
  // and a later sibling would otherwise paint straight over the pinned bar.
  filterSticky: {
    zIndex: 5,
    // Both paddings are cancelled by matching negative margins: the band only exists once
    // the bar is pinned, and at rest the list should sit exactly where it did before. The
    // top half is what keeps the pinned bar off the navbar's underside instead of welded
    // to it; the bottom half is the run the mask needs to fade out over.
    paddingTop: theme.spacing.md,
    marginTop: -theme.spacing.md,
    paddingBottom: theme.spacing.md,
    marginBottom: -theme.spacing.md,
    ...(Platform.OS === "web" ? ({ position: "sticky", top: 0 } as object) : null),
  },
  list: {
    gap: theme.spacing.md,
  },
  /**
   * Off web the page is three ScrollView children rather than one PageContainer, so the bar's
   * band can be pinned by index; these carry PageContainer's insets across the split, with
   * the vertical run between the sections adding up to the gap the web page keeps.
   */
  nativeSection: {
    width: "100%",
    alignItems: "center",
  },
  nativeColumn: {
    width: "100%",
    maxWidth: 820,
  },
  nativeHead: {
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.xs,
  },
  nativeBody: {
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.xxl,
  },
  nativeFilterBand: {
    zIndex: 5,
    alignItems: "center",
    paddingVertical: theme.spacing.md,
  },
  nativeSummary: {
    fontSize: 12.5,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
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
