import { useEffect, useState, type ComponentProps } from "react";
import { View, StyleSheet, Pressable, Linking, useWindowDimensions } from "react-native";
import { Link } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/use-app-theme";
import { SPACING } from "@/theme/theme";
import { fetchSocialLinks, SocialLinkDto } from "@/api/restaurants";

interface FooterProps {
  /** Override the footer's background so it matches a page that doesn't use the default themed page color. */
  backgroundColor?: string;
}

export default function Footer({ backgroundColor }: FooterProps) {
  const { brand, colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const isMobile = width < 600;

  const [socialLinks, setSocialLinks] = useState<SocialLinkDto[]>([]);

  useEffect(() => {
    fetchSocialLinks().then(setSocialLinks);
  }, []);

  const year = new Date().getFullYear();
  const copyright =
    brand.copyrightText?.trim() || `© ${year} ${brand.appName}. All rights reserved.`;

  return (
    <ThemedView
      style={[
        styles.footer,
        { borderTopColor: colors.border },
        backgroundColor && { backgroundColor },
      ]}
    >
      <View style={[styles.inner, isMobile && styles.innerMobile]}>
        <ThemedText style={[styles.copyright, { color: colors.muted }]}>{copyright}</ThemedText>

        <View style={styles.right}>
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
                    size={16}
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
              style={styles.adminBtn}
            >
              <Ionicons name="settings-outline" size={13} color={colors.muted} />
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
    rowGap: 6,
    columnGap: SPACING.md,
    maxWidth: 1320,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingVertical: 6,
  },
  innerMobile: {
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  copyright: {
    fontSize: 12,
    lineHeight: 16,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  social: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  socialBtn: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  adminBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 18,
  },
  adminText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
});
