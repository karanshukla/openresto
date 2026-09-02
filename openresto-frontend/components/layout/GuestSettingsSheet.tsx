import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import ButtonRow from "@/components/common/ButtonRow";
import { Icon, type IconName } from "@/components/common/Icon";
import { ModalCard } from "@/components/common/ModalCard";
import { LocaleRadioList } from "@/components/common/LocaleRadioList";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useTheme, type ThemePreference } from "@/context/ThemeContext";
import { fetchSocialLinks, type SocialLinkDto } from "@/api/restaurants";
import { openExternal } from "@/utils/openExternal";
import { currentAppVersion } from "@/utils/appVersion";
import { styles } from "./GuestSettingsSheet.styles";

/**
 * Language and appearance for the native guest app. The web build reaches both through the
 * navbar's `OverflowMenu`, which does not render off web, so without this a diner on a phone
 * has no way to change either.
 *
 * It also carries what a website puts in its footer. A footer is a document paradigm — the
 * bottom of one long page — and an app has screens instead, so repeating that band under
 * every screen reads as a website in a wrapper (and now stacks above the tab bar). Social
 * links, the privacy policy both stores require, the copyright and the build all belong in
 * one About section reached deliberately, which is where a native user looks for them.
 *
 * @see [GuestSettingsSheet.test.tsx](../../tests/components/layout/GuestSettingsSheet.test.tsx)
 * — pins the language rows, the theme pick writing through `setPreference`, dismissal, and
 * that About carries the footer's contents while the admin link stays off native.
 */
export default function GuestSettingsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { brand, colors } = useAppTheme();
  const { preference, setPreference } = useTheme();
  const [socialLinks, setSocialLinks] = useState<SocialLinkDto[]>([]);
  const appVersion = currentAppVersion();

  // Only while the sheet is open: the guest surface mounts this on every screen, and the
  // links are not on screen until it is.
  useEffect(() => {
    if (!visible) return;
    fetchSocialLinks().then(setSocialLinks);
  }, [visible]);

  const year = new Date().getFullYear();
  const copyright =
    brand.copyrightText?.trim() ||
    t("common.footer.copyrightFallback", { year, appName: brand.appName });

  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: "system", label: t("common.guestSettings.themeSystem") },
    { value: "light", label: t("common.guestSettings.themeLight") },
    { value: "dark", label: t("common.guestSettings.themeDark") },
  ];

  return (
    <ModalCard
      visible={visible}
      title={t("common.guestSettings.title")}
      onDismiss={onClose}
      dismissLabel={t("common.guestSettings.closeLabel")}
      testID="guest-settings"
    >
      <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>
        {t("common.language.switcherLabel")}
      </ThemedText>
      <LocaleRadioList />

      <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>
        {t("common.guestSettings.appearance")}
      </ThemedText>
      <View
        style={styles.list}
        role="radiogroup"
        accessibilityLabel={t("common.guestSettings.appearance")}
        testID="theme-radiogroup"
      >
        {themeOptions.map((option) => {
          const checked = option.value === preference;
          return (
            <Pressable
              key={option.value}
              onPress={() => setPreference(option.value)}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked }}
              style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
                styles.row,
                (hovered || pressed) && { backgroundColor: colors.input },
              ]}
            >
              <ThemedText style={styles.rowText}>{option.label}</ThemedText>
              {checked && <Icon name="checkmark" size="md" color={colors.muted} />}
            </Pressable>
          );
        })}
      </View>

      <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>
        {t("common.guestSettings.about")}
      </ThemedText>
      <View style={styles.list} testID="guest-settings-about">
        {socialLinks.map((link) => (
          <Pressable
            key={link.id}
            onPress={() => openExternal(link.url)}
            accessibilityRole="link"
            accessibilityLabel={link.label}
            style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
              styles.row,
              (hovered || pressed) && { backgroundColor: colors.input },
            ]}
          >
            <ThemedText style={styles.rowText}>{link.label}</ThemedText>
            <Icon name={link.iconKey as IconName} size="md" color={colors.muted} />
          </Pressable>
        ))}

        {brand.privacyPolicyUrl && (
          <Pressable
            testID="guest-settings-privacy"
            onPress={() => openExternal(brand.privacyPolicyUrl!)}
            accessibilityRole="link"
            accessibilityLabel={t("common.footer.privacyPolicy")}
            style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
              styles.row,
              (hovered || pressed) && { backgroundColor: colors.input },
            ]}
          >
            <ThemedText style={styles.rowText}>{t("common.footer.privacyPolicy")}</ThemedText>
            <Icon name="shield-checkmark-outline" size="md" color={colors.muted} />
          </Pressable>
        )}
      </View>

      <ThemedText
        testID="guest-settings-copyright"
        style={[styles.finePrint, { color: colors.muted }]}
      >
        {copyright}
        {appVersion
          ? `
${t("common.guestSettings.version", { version: appVersion })}`
          : ""}
      </ThemedText>

      <ThemedText style={[styles.sectionLabel, { color: colors.muted }]}>
        {t("common.overflowMenu.help")}
      </ThemedText>
      {/* Shares the web overflow menu's copy rather than restating it, so the two surfaces
          cannot describe the same app differently. Keyboard shortcuts, the menu's fourth row,
          deliberately has no counterpart here: `useKeyboardShortcuts` returns early off web,
          so the row would open help for shortcuts that never fire. */}
      <ThemedText testID="guest-settings-help" style={[styles.helpBody, { color: colors.muted }]}>
        {t("common.overflowMenu.helpBody")}
      </ThemedText>

      <ButtonRow>
        <Button
          testID="guest-settings-close"
          variant="secondary"
          tone="neutral"
          size="md"
          onPress={onClose}
        >
          {t("common.actions.close")}
        </Button>
      </ButtonRow>
    </ModalCard>
  );
}
