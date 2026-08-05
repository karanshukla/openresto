/**
 * Unistyles spike (issue #219) — SPIKE-ONLY ROUTE.
 *
 * Exists so a reviewer can eyeball every Unistyles capability the spike needed
 * to prove out (themes, runtime theme switching, variants, breakpoints, media
 * queries, web-only styles, brand-colour injection) against this project's real
 * config. Delete this file when the spike is closed out, whichever way the
 * recommendation lands.
 */
import "@/theme/unistyles";
import { Pressable, ScrollView, View } from "react-native";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { useTheme } from "@/context/ThemeContext";
import { useBrand } from "@/context/BrandContext";

const SWATCHES = [
  "page",
  "surface",
  "card",
  "input",
  "border",
  "text",
  "muted",
  "primary",
  "success",
  "error",
  "warning",
  "info",
] as const;

const BUTTON_SIZES = ["primary", "secondary", "small", "icon"] as const;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      <ThemedText style={styles.rowValue}>{value}</ThemedText>
    </View>
  );
}

export default function UnistylesPocScreen() {
  const { theme, rt } = useUnistyles();
  const { colorScheme, preference, setPreference, toggle } = useTheme();
  const brand = useBrand();

  return (
    <ScrollView contentContainerStyle={styles.container} testID="unistyles-poc">
      <View style={styles.header}>
        <ThemedText type="h1">Unistyles spike</ThemedText>
        <ThemedText style={styles.subtitle}>
          Every style on this screen comes from `StyleSheet.create` in `react-native-unistyles`,
          resolved against the tokens in `theme/theme.ts`.
        </ThemedText>
      </View>

      <View style={styles.card}>
        <ThemedText type="h3">Runtime</ThemedText>
        <Row label="Unistyles theme" value={rt.themeName ?? "—"} />
        <Row label="ThemeContext scheme" value={colorScheme} />
        <Row label="Stored preference" value={preference} />
        <Row label="Breakpoint" value={rt.breakpoint ?? "—"} />
        <Row
          label="Screen"
          value={`${Math.round(rt.screen.width)}×${Math.round(rt.screen.height)}`}
        />
        <Row label="Brand primary" value={brand.primaryColor} />
        <Row label="theme.colors.primary" value={theme.colors.primary} />
      </View>

      <View style={styles.card}>
        <ThemedText type="h3">Light / dark switching</ThemedText>
        <ThemedText style={styles.body}>
          The app keeps owning the preference; `useUnistylesBridge` forwards it to
          `UnistylesRuntime.setTheme`, so both systems stay in step during the migration.
        </ThemedText>
        <View style={styles.actions}>
          <Button size="small" onPress={toggle}>
            Toggle
          </Button>
          <Button size="small" onPress={() => setPreference("light")}>
            Light
          </Button>
          <Button size="small" onPress={() => setPreference("dark")}>
            Dark
          </Button>
          <Button size="small" onPress={() => setPreference("system")}>
            System
          </Button>
        </View>
      </View>

      <View style={styles.card}>
        <ThemedText type="h3">Theme tokens</ThemedText>
        <View style={styles.swatchGrid}>
          {SWATCHES.map((name) => (
            <View key={name} style={styles.swatchCell}>
              <View style={styles.swatch(theme.colors[name])} />
              <ThemedText style={styles.swatchLabel}>{name}</ThemedText>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <ThemedText type="h3">Variants</ThemedText>
        <ThemedText style={styles.body}>
          `components/common/Button` is migrated in place — its four sizes and its disabled state
          are Unistyles variants rather than conditional style arrays.
        </ThemedText>
        <View style={styles.actions}>
          {BUTTON_SIZES.map((size) => (
            <Button key={size} size={size}>
              {size}
            </Button>
          ))}
        </View>
        <View style={styles.actions}>
          <Button disabled>disabled</Button>
        </View>
      </View>

      <View style={styles.card}>
        <ThemedText type="h3">Breakpoints &amp; media queries</ThemedText>
        <ThemedText style={styles.body}>
          The tiles below re-flow from one column to four purely through breakpoint values in the
          stylesheet — no `useWindowDimensions`, no re-render.
        </ThemedText>
        <View style={styles.tileGrid}>
          {[1, 2, 3, 4].map((n) => (
            <Pressable key={n} style={styles.tile}>
              <ThemedText style={styles.tileText}>Tile {n}</ThemedText>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme, rt) => ({
  container: {
    padding: theme.spacing.xl,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl + rt.insets.bottom,
    maxWidth: 1100,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    gap: theme.spacing.sm,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.muted,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.card,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    ...theme.shadows.sm,
  },
  body: {
    ...theme.typography.caption,
    color: theme.colors.muted,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  rowLabel: {
    ...theme.typography.label,
    color: theme.colors.muted,
  },
  rowValue: {
    ...theme.typography.label,
    fontFamily: "monospace",
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    alignItems: "center",
  },
  swatchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  swatchCell: {
    alignItems: "center",
    gap: theme.spacing.xs,
    width: 78,
  },
  swatch: (color: string) => ({
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: color,
  }),
  swatchLabel: {
    ...theme.typography.captionSmall,
    color: theme.colors.muted,
  },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  tile: {
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    flexBasis: {
      xs: "100%",
      sm: "48%",
      lg: "23%",
    },
    _web: {
      _hover: {
        borderColor: theme.colors.primary,
      },
    },
  },
  tileText: {
    ...theme.typography.bodyBold,
  },
}));
