import { type ReactNode } from "react";
import { Platform, ScrollView, View } from "react-native";
import { Stack } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./settings.styles";

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
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { colors } = useAppTheme();

  return (
    <ScrollView contentContainerStyle={styles.settingsContainer}>
      {Platform.OS !== "web" && <Stack.Screen options={{ title }} />}

      <View style={styles.pageHeader}>
        <View>
          <ThemedText type="h1">{title}</ThemedText>
          <ThemedText style={[styles.pageSub, { color: colors.muted }]}>{subtitle}</ThemedText>
        </View>
      </View>

      <View style={styles.section}>{children}</View>
    </ScrollView>
  );
}
