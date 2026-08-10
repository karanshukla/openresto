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
    gap: theme.spacing.xs,
  },
  title: {
    ...theme.typography.h1,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
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
