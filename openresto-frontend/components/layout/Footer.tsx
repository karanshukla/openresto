import { useEffect, useState, type ComponentProps } from "react";
import { View, StyleSheet, Pressable, Linking, useWindowDimensions } from "react-native";
import { Link } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/use-app-theme";
import { SPACING } from "@/theme/theme";
import { fetchSocialLinks, SocialLinkDto } from "@/api/restaurants";

export default function Footer() {
  const { brand, colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [socialLinks, setSocialLinks] = useState<SocialLinkDto[]>([]);

  useEffect(() => {
    fetchSocialLinks().then(setSocialLinks);
  }, []);

  const year = new Date().getFullYear();
  const copyright =
    brand.copyrightText?.trim() || `© ${year} ${brand.appName}. All rights reserved.`;

  return (
    <ThemedView style={[styles.footer, { borderTopColor: colors.border }]}>
      <View style={[styles.inner, isMobile && styles.innerMobile]}>
        <ThemedText style={[styles.copyright, { color: colors.muted }]}>{copyright}</ThemedText>

        <View style={[styles.right, isMobile && styles.rightMobile]}>
          {socialLinks.length > 0 && (
            <View style={styles.social}>
              {socialLinks.map((link) => (
                <Pressable
                  key={link.id}
                  onPress={() => Linking.openURL(link.url)}
                  accessibilityRole="link"
                  accessibilityLabel={link.label}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  style={({ hovered }: any) => [styles.socialBtn, hovered && { opacity: 0.65 }]}
                >
                  <Ionicons
                    name={link.iconKey as ComponentProps<typeof Ionicons>["name"]}
                    size={18}
                    color={colors.muted}
                  />
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
              <Ionicons name="settings-outline" size={14} color={colors.muted} />
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
    gap: SPACING.sm,
    maxWidth: 1320,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingVertical: SPACING.sm,
  },
  innerMobile: {
    flexDirection: "column",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    gap: SPACING.xs,
  },
  copyright: {
    fontSize: 12,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.lg,
  },
  rightMobile: {
    width: "100%",
    justifyContent: "space-between",
  },
  social: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  socialBtn: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  adminBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  adminText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
