import { useEffect, useState } from "react";
import { View, Platform, Pressable, Linking, useWindowDimensions } from "react-native";
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { fetchSocialLinks, SocialLinkDto } from "@/api/restaurants";
import { openExternal } from "@/utils/openExternal";
import { styles } from "./Footer.styles";
import { Icon, type IconName } from "@/components/common/Icon";

/**
 * The end of every guest screen: copyright, social links, the privacy policy both app stores
 * require a listing to reach, and — on web — the way in to the admin.
 *
 * Off web it collapses to a centred stack with its links wrapped above the fine print, and the
 * admin link goes: `app/admin/_layout.tsx` redirects off web, so in the app that row is a
 * website's site map pointing at a screen that hands you straight back to the home page.
 *
 * @see [Footer.test.tsx](../../tests/components/layout/Footer.test.tsx) — pins that the privacy
 * policy and the social links survive the native layout while the admin link does not, and that
 * web keeps its single space-between row.
 */
export default function Footer() {
  const { brand, colors } = useAppTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isMobile = width < 600;
  const isWeb = Platform.OS === "web";

  const [socialLinks, setSocialLinks] = useState<SocialLinkDto[]>([]);

  useEffect(() => {
    fetchSocialLinks().then(setSocialLinks);
  }, []);

  const year = new Date().getFullYear();
  const copyright =
    brand.copyrightText?.trim() ||
    t("common.footer.copyrightFallback", { year, appName: brand.appName });

  return (
    <ThemedView
      testID="site-footer"
      style={[styles.footer, { borderTopColor: colors.border, paddingBottom: insets.bottom }]}
    >
      <View
        testID="footer-inner"
        style={[styles.inner, isMobile && styles.innerMobile, !isWeb && styles.innerStacked]}
      >
        <ThemedText style={[styles.copyright, { color: colors.muted }]}>{copyright}</ThemedText>

        <View testID="footer-links" style={[styles.right, !isWeb && styles.rightWrapped]}>
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

          {brand.privacyPolicyUrl && (
            <Pressable
              onPress={() => openExternal(brand.privacyPolicyUrl!)}
              accessibilityRole="link"
              accessibilityLabel={t("common.footer.privacyPolicy")}
              hitSlop={10}
              style={styles.adminBtn}
            >
              <Icon name="shield-checkmark-outline" size="sm" color={colors.muted} />
              <ThemedText style={[styles.adminText, { color: colors.muted }]}>
                {t("common.footer.privacyPolicy")}
              </ThemedText>
            </Pressable>
          )}

          {isWeb && (
            <Link href={"/admin/dashboard" as const} asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t("common.footer.restaurantAdminLabel")}
                hitSlop={10}
                style={styles.adminBtn}
              >
                <Icon name="settings-outline" size="sm" color={colors.muted} />
                <ThemedText style={[styles.adminText, { color: colors.muted }]}>
                  {t("common.footer.adminLinkText")}
                </ThemedText>
              </Pressable>
            </Link>
          )}
        </View>
      </View>
    </ThemedView>
  );
}
