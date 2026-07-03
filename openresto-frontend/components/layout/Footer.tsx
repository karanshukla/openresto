import { View, StyleSheet, Pressable, Linking, useWindowDimensions } from "react-native";
import { Link } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/use-app-theme";
import { SPACING, BORDER_RADIUS } from "@/theme/theme";
import { SocialLinks } from "@/types";

const SOCIAL_ICONS: {
  key: keyof SocialLinks;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}[] = [
  { key: "instagram", icon: "logo-instagram", label: "Instagram" },
  { key: "facebook", icon: "logo-facebook", label: "Facebook" },
  { key: "twitter", icon: "logo-x", label: "X (Twitter)" },
  { key: "tiktok", icon: "logo-tiktok", label: "TikTok" },
  { key: "youtube", icon: "logo-youtube", label: "YouTube" },
];

export default function Footer() {
  const { brand, colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const year = new Date().getFullYear();
  const copyright =
    brand.copyrightText?.trim() || `© ${year} ${brand.appName}. All rights reserved.`;
  const socialEntries = SOCIAL_ICONS.filter((s) => brand.socialLinks?.[s.key]);

  return (
    <ThemedView style={[styles.footer, { borderTopColor: colors.border }]}>
      <View style={[styles.inner, isMobile && styles.innerMobile]}>
        <ThemedText style={[styles.copyright, { color: colors.muted }]}>{copyright}</ThemedText>

        <View style={[styles.right, isMobile && styles.rightMobile]}>
          {socialEntries.length > 0 && (
            <View style={styles.social}>
              {socialEntries.map(({ key, icon, label }) => (
                <Pressable
                  key={key}
                  onPress={() => Linking.openURL(brand.socialLinks![key]!)}
                  accessibilityRole="link"
                  accessibilityLabel={label}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  style={({ hovered }: any) => [styles.socialBtn, hovered && { opacity: 0.65 }]}
                >
                  <Ionicons name={icon} size={18} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          )}

          <Link href={"/(admin)/dashboard" as const} asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Restaurant admin"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              style={({ hovered }: any) => [styles.adminBtn, hovered && { opacity: 0.65 }]}
            >
              <Ionicons name="lock-closed-outline" size={13} color={colors.muted} />
              <ThemedText style={[styles.adminText, { color: colors.muted }]}>Admin</ThemedText>
            </Pressable>
          </Link>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  footer: {
    width: "100%",
    borderTopWidth: 1,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: SPACING.md,
    maxWidth: 1320,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingVertical: SPACING.xl,
  },
  innerMobile: {
    flexDirection: "column",
    alignItems: "flex-start",
    paddingHorizontal: 12,
  },
  copyright: {
    fontSize: 13,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xl,
  },
  rightMobile: {
    width: "100%",
    justifyContent: "space-between",
  },
  social: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  socialBtn: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  adminBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
  },
  adminText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
