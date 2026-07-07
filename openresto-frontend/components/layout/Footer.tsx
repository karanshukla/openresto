import { useEffect, useState, type ComponentProps } from "react";
import { View, StyleSheet, Pressable, Linking, useWindowDimensions } from "react-native";
import { Link } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@/hooks/use-app-theme";
import { theme } from "@/theme/theme";
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
                  hitSlop={10}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  style={({ hovered }: any) => [styles.socialBtn, hovered && { opacity: 0.65 }]}
                >
                  <Ionicons
                    name={link.iconKey as ComponentProps<typeof Ionicons>["name"]}
                    size={17}
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
              hitSlop={10}
              style={styles.adminBtn}
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
    rowGap: theme.spacing.sm,
    columnGap: theme.spacing.md,
    maxWidth: 1320,
    width: "100%",
    minHeight: 56,
    alignSelf: "center",
    paddingHorizontal: 28,
    paddingVertical: theme.spacing.lg,
  },
  innerMobile: {
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  copyright: {
    fontSize: 13,
    lineHeight: 18,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.lg,
  },
  social: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
  },
  socialBtn: {
    minWidth: 32,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  adminBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 32,
    paddingHorizontal: theme.spacing.xs,
  },
  adminText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
});
