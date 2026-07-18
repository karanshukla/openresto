import { ScrollView, View, Platform } from "react-native";
import { Stack } from "expo-router";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

// Components
import { BrandSettingsCard } from "@/components/admin/settings/BrandSettingsCard";
import { FooterSettingsCard } from "@/components/admin/settings/FooterSettingsCard";
import { EmailSettingsCard } from "@/components/admin/settings/EmailSettingsCard";
import { SecurityCard } from "@/components/admin/settings/SecurityCard";
import { HighlightsCard } from "@/components/admin/settings/HighlightsCard";
import { PushNotificationsCard } from "@/components/admin/settings/PushNotificationsCard";
import { styles } from "@/components/admin/settings/settings.styles";

export default function AdminSettingsScreen() {
  const { colors, isDark } = useAppTheme();

  const borderColor = colors.border;
  const cardBg = colors.card;
  const mutedColor = colors.muted;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {Platform.OS !== "web" && <Stack.Screen options={{ title: "Settings" }} />}

      {/* Page header */}
      <View style={styles.pageHeader}>
        <View>
          <ThemedText type="h1">Settings</ThemedText>
          <ThemedText style={[styles.pageSub, { color: mutedColor }]}>
            Manage brand, email, and security.
          </ThemedText>
        </View>
      </View>

      {/* Global Settings */}
      <View style={styles.section}>
        <ThemedText style={[styles.sectionHeading, { color: mutedColor }]}>
          GLOBAL SETTINGS
        </ThemedText>
        <BrandSettingsCard borderColor={borderColor} mutedColor={mutedColor} cardBg={cardBg} />
        <FooterSettingsCard borderColor={borderColor} mutedColor={mutedColor} cardBg={cardBg} />
        <HighlightsCard borderColor={borderColor} mutedColor={mutedColor} cardBg={cardBg} />
        <EmailSettingsCard
          borderColor={borderColor}
          mutedColor={mutedColor}
          cardBg={cardBg}
          isDark={isDark}
        />
        <PushNotificationsCard />
      </View>

      {/* Account Security */}
      <View style={styles.section}>
        <ThemedText style={[styles.sectionHeading, { color: mutedColor }]}>
          ACCOUNT SECURITY
        </ThemedText>
        <SecurityCard borderColor={borderColor} mutedColor={mutedColor} cardBg={cardBg} />
      </View>
    </ScrollView>
  );
}
