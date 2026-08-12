import { useEffect, useState } from "react";
import { View, Pressable, Linking, useWindowDimensions } from "react-native";
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { fetchSocialLinks, SocialLinkDto } from "@/api/restaurants";
import { styles } from "./Footer.styles";
import { Icon, type IconName } from "@/components/common/Icon";

export default function Footer() {
  const { brand, colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
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
      style={[styles.footer, { borderTopColor: colors.border, paddingBottom: insets.bottom }]}
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
                  hitSlop={8}
                  style={({ hovered }: any) => [styles.socialBtn, hovered && { opacity: 0.65 }]}
                >
                  <Icon name={link.iconKey as IconName} size={15} color={colors.muted} />
                  <ThemedText style={[styles.socialLabel, { color: colors.muted }]}>
                    {link.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          )}

          <Link href={"/admin/dashboard" as const} asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Restaurant admin"
              hitSlop={10}
              style={styles.adminBtn}
            >
              <Icon name="settings-outline" size="sm" color={colors.muted} />
              <ThemedText style={[styles.adminText, { color: colors.muted }]}>Admin</ThemedText>
            </Pressable>
          </Link>
        </View>
      </View>
    </ThemedView>
  );
}
