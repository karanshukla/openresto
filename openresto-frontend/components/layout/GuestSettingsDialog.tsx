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
import { styles } from "./GuestSettingsDialog.styles";

export type GuestSettingsPane = "language" | "appearance" | "about" | "help";

/**
 * One pane of the guest settings, opened from a row of `GuestSettingsMenu`.
 *
 * Splitting the settings across four small dialogs rather than stacking every control in one
 * is what keeps any of them off a scrollbar. A settings list a person has to scroll to reach
 * the bottom of is a list that should have been a menu.
 *
 * @see [GuestSettingsMenu.test.tsx](../../tests/components/layout/GuestSettingsMenu.test.tsx)
 * — pins which control each pane carries, and that About holds what the web footer does.
 */
export default function GuestSettingsDialog({
  pane,
  onClose,
}: {
  pane: GuestSettingsPane | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { brand, colors } = useAppTheme();
  const { preference, setPreference } = useTheme();
  const [socialLinks, setSocialLinks] = useState<SocialLinkDto[]>([]);
  const appVersion = currentAppVersion();

  // Only the About pane draws them, so nothing else pays for the request.
  useEffect(() => {
    if (pane !== "about") return;
    fetchSocialLinks().then(setSocialLinks);
  }, [pane]);

  const themeOptions: { value: ThemePreference; label: string }[] = [
    { value: "system", label: t("common.guestSettings.themeSystem") },
    { value: "light", label: t("common.guestSettings.themeLight") },
    { value: "dark", label: t("common.guestSettings.themeDark") },
  ];

  const titles: Record<GuestSettingsPane, string> = {
    language: t("common.overflowMenu.language"),
    appearance: t("common.guestSettings.appearance"),
    about: t("common.guestSettings.about"),
    help: t("common.overflowMenu.help"),
  };

  const year = new Date().getFullYear();
  const copyright =
    brand.copyrightText?.trim() ||
    t("common.footer.copyrightFallback", { year, appName: brand.appName });

  const linkRow = (key: string, label: string, icon: IconName, url: string) => (
    <Pressable
      key={key}
      testID={`guest-settings-link-${key}`}
      onPress={() => openExternal(url)}
      accessibilityRole="link"
      accessibilityLabel={label}
      style={({ pressed }: { pressed: boolean }) => [
        styles.row,
        pressed && { backgroundColor: colors.input },
      ]}
    >
      <ThemedText style={styles.rowText}>{label}</ThemedText>
      <Icon name={icon} size="md" color={colors.muted} />
    </Pressable>
  );

  return (
    <ModalCard
      visible={pane !== null}
      title={pane ? titles[pane] : ""}
      onDismiss={onClose}
      dismissLabel={t("common.guestSettings.closeLabel")}
      testID="guest-settings-dialog"
    >
      {pane === "language" && <LocaleRadioList />}

      {pane === "appearance" && (
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
                style={({ pressed }: { pressed: boolean }) => [
                  styles.row,
                  pressed && { backgroundColor: colors.input },
                ]}
              >
                <ThemedText style={styles.rowText}>{option.label}</ThemedText>
                {checked && <Icon name="checkmark" size="md" color={colors.muted} />}
              </Pressable>
            );
          })}
        </View>
      )}

      {pane === "about" && (
        <View style={styles.list} testID="guest-settings-about">
          {socialLinks.map((link) =>
            linkRow(String(link.id), link.label, link.iconKey as IconName, link.url)
          )}
          {brand.privacyPolicyUrl &&
            linkRow(
              "privacy",
              t("common.footer.privacyPolicy"),
              "shield-checkmark-outline",
              brand.privacyPolicyUrl
            )}
          <ThemedText
            testID="guest-settings-copyright"
            style={[styles.fine, { color: colors.muted }]}
          >
            {copyright}
            {appVersion ? `\n${t("common.guestSettings.version", { version: appVersion })}` : ""}
          </ThemedText>
        </View>
      )}

      {pane === "help" && (
        <ThemedText testID="guest-settings-help" style={[styles.help, { color: colors.muted }]}>
          {t("common.overflowMenu.helpBody")}
        </ThemedText>
      )}

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
