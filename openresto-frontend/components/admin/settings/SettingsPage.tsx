import { type ReactNode } from "react";
import { Platform, ScrollView, useWindowDimensions, View } from "react-native";
import { Stack } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles, stickyAside, SPLIT_MIN_WIDTH } from "./settings.styles";

/** The three palette values every settings card takes. */
export function useSettingsPalette() {
  const { colors } = useAppTheme();
  return { borderColor: colors.border, mutedColor: colors.muted, cardBg: colors.card };
}

/**
 * Shared chrome for the settings routes: scroll container, page title, and the stacked
 * card column. Each route under /admin/settings is one concern's worth of cards inside it.
 */
export function SettingsPage({
  title,
  subtitle,
  aside,
  children,
}: {
  title: string;
  subtitle: string;
  /**
   * A companion panel (today: the brand preview) shown beside the cards on a wide viewport and
   * above them on anything narrower — a settings form the admin can't reach is worse than a
   * preview they have to scroll past.
   */
  aside?: ReactNode;
  children: ReactNode;
}) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const isSplit = !!aside && width >= SPLIT_MIN_WIDTH;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {Platform.OS !== "web" && <Stack.Screen options={{ title }} />}

      <View style={styles.pageHeader}>
        <View>
          <ThemedText type="h1">{title}</ThemedText>
          <ThemedText style={[styles.pageSub, { color: colors.muted }]}>{subtitle}</ThemedText>
        </View>
      </View>

      {isSplit ? (
        <View style={styles.split}>
          <View style={[styles.section, styles.splitForm]}>{children}</View>
          <View style={styles.splitAside}>
            <View style={Platform.OS === "web" ? (stickyAside as object) : undefined}>{aside}</View>
          </View>
        </View>
      ) : (
        <View style={styles.section}>
          {aside}
          {children}
        </View>
      )}
    </ScrollView>
  );
}
