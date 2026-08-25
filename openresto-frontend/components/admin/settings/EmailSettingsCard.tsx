import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { View, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { ButtonRow } from "@/components/common/ButtonRow";
import { theme, getThemeColors } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { EMAIL_PROVIDERS, type EmailSettingsState } from "@/hooks/use-email-settings";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { styles as settingsStyles } from "./settings.styles";
import { AccordionCardHeader } from "./AccordionCardHeader";
import { styles } from "./EmailSettingsCard.styles";
import { SubLabel } from "./settingsShared";
import { BookingConfirmationToggle } from "./BookingConfirmationToggle";
import { Icon } from "@/components/common/Icon";

const PORT_PRESETS = [25, 465, 587, 2525];

/**
 * The SMTP credentials form. Connection status and delivery failures live in the
 * `EmailDeliveryPanel` beside it rather than in a column inside this card, so the card is a form
 * like every other settings card and the page owns the layout.
 */
export function EmailSettingsCard({
  borderColor,
  mutedColor,
  cardBg,
  isDark,
  email,
}: {
  borderColor: string;
  mutedColor: string;
  cardBg: string;
  isDark: boolean;
  email: EmailSettingsState;
}) {
  const { t } = useTranslation();
  const { text: textColor } = getThemeColors(isDark);
  const surface2 = isDark ? "#252729" : "#f9fafb";
  const borderStrong = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)";
  const okColor = theme.colors.success;
  const okSoft = isDark ? `${okColor}22` : "#dcfce7";
  const okBorder = `${okColor}50`;

  const [showPassword, setShowPassword] = useState(false);
  const [expanded, setExpanded] = usePersistedState("settings:email:expanded", true);

  const { primaryColor } = useAppTheme();
  const accentSoft = `${primaryColor}18`;

  const {
    host,
    setHost,
    port,
    setPort,
    username,
    setUsername,
    password,
    setPassword,
    enableSsl,
    setEnableSsl,
    fromName,
    setFromName,
    fromEmail,
    setFromEmail,
    saving,
    testState,
    saveMsg,
    isConfigured,
    sendConfirmations,
    activeProviderId,
    selectProvider,
    handleSave,
    toggleConfirmations,
    confirmDisabled,
  } = email;

  return (
    <View style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <AccordionCardHeader
        icon="mail-outline"
        title={t("admin.settings.emailSettings.title")}
        subtitle={
          isConfigured
            ? t("admin.settings.emailSettings.connectedSubtitle", { host })
            : t("admin.settings.emailSettings.setupRequired")
        }
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        primaryColor={primaryColor}
        mutedColor={mutedColor}
      />

      <AnimatedAccordion expanded={expanded}>
        <View style={[settingsStyles.secForm, styles.form, { borderTopColor: borderColor }]}>
          <View style={styles.providerBlock}>
            <SubLabel mutedColor={mutedColor}>
              {t("admin.settings.emailSettings.providerLabel")}
            </SubLabel>
            <View style={styles.providerGrid}>
              {EMAIL_PROVIDERS.map((p) => {
                const on = activeProviderId === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => selectProvider(p)}
                    accessibilityRole="radio"
                    accessibilityLabel={p.name}
                    accessibilityState={{ checked: on }}
                    style={[
                      styles.providerCard,
                      {
                        borderColor: on ? primaryColor : borderColor,
                        backgroundColor: on ? cardBg : surface2,
                      },
                      on && [styles.providerCardSelected, { shadowColor: primaryColor }],
                    ]}
                  >
                    <View
                      style={[
                        styles.providerIcon,
                        {
                          backgroundColor: on ? accentSoft : cardBg,
                          borderWidth: on ? 0 : 1,
                          borderColor,
                        },
                      ]}
                    >
                      <Icon name={p.icon} size={15} color={on ? primaryColor : mutedColor} />
                    </View>
                    <ThemedText style={styles.providerName}>{p.name}</ThemedText>
                    <ThemedText style={[styles.providerHint, { color: mutedColor }]}>
                      {p.hint}
                    </ThemedText>
                    {on && (
                      <View style={[styles.providerCheck, { backgroundColor: primaryColor }]}>
                        <Icon name="checkmark" size={11} color="#fff" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.connectionBlock}>
            <SubLabel mutedColor={mutedColor}>
              {t("admin.settings.emailSettings.connectionLabel")}
            </SubLabel>

            <View style={settingsStyles.field}>
              <ThemedText style={settingsStyles.fieldLabel}>
                {t("admin.settings.emailSettings.hostLabel")}
              </ThemedText>
              <Input
                value={host}
                onChangeText={setHost}
                placeholder="smtp.gmail.com"
                autoCapitalize="none"
              />
            </View>

            <View style={settingsStyles.fieldRow}>
              <View style={[settingsStyles.field, settingsStyles.fieldFlex]}>
                <ThemedText style={settingsStyles.fieldLabel}>
                  {t("admin.settings.emailSettings.portLabel")}
                </ThemedText>
                <View style={styles.portRow}>
                  <View style={styles.portInput}>
                    <Input
                      value={port}
                      onChangeText={setPort}
                      placeholder="587"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.portPresets}>
                    {PORT_PRESETS.map((p) => (
                      <Pressable
                        key={p}
                        onPress={() => setPort(String(p))}
                        accessibilityRole="radio"
                        accessibilityLabel={t("admin.settings.emailSettings.usePortLabel", {
                          port: p,
                        })}
                        accessibilityState={{ checked: port === String(p) }}
                        style={[
                          styles.portPreset,
                          {
                            borderColor: port === String(p) ? borderStrong : borderColor,
                            backgroundColor: port === String(p) ? cardBg : surface2,
                          },
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.portPresetText,
                            { color: port === String(p) ? textColor : mutedColor },
                          ]}
                        >
                          {p}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              <View style={[settingsStyles.field, settingsStyles.fieldFlex]}>
                <ThemedText style={settingsStyles.fieldLabel}>
                  {t("admin.settings.emailSettings.encryptionLabel")}
                </ThemedText>
                <View style={styles.encryptionRow}>
                  <Pressable
                    onPress={() => setEnableSsl(true)}
                    accessibilityRole="radio"
                    accessibilityLabel={t("admin.settings.emailSettings.sslTlsA11yLabel")}
                    accessibilityState={{ checked: enableSsl }}
                    style={[
                      styles.encryptionOption,
                      styles.encryptionOptionWithIcon,
                      {
                        borderColor: enableSsl ? okBorder : borderColor,
                        backgroundColor: enableSsl ? okSoft : surface2,
                      },
                    ]}
                  >
                    <Icon
                      name="shield-checkmark"
                      size={13}
                      color={enableSsl ? okColor : mutedColor}
                    />
                    <ThemedText
                      style={[
                        styles.encryptionLabel,
                        enableSsl && styles.encryptionLabelOn,
                        { color: enableSsl ? okColor : mutedColor },
                      ]}
                    >
                      {t("admin.settings.emailSettings.sslTls")}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => setEnableSsl(false)}
                    accessibilityRole="radio"
                    accessibilityLabel={t("admin.settings.emailSettings.noEncryptionA11yLabel")}
                    accessibilityState={{ checked: !enableSsl }}
                    style={[
                      styles.encryptionOption,
                      {
                        borderColor: !enableSsl ? borderStrong : borderColor,
                        backgroundColor: !enableSsl ? cardBg : surface2,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.encryptionLabel,
                        !enableSsl && styles.encryptionLabelOn,
                        { color: !enableSsl ? textColor : mutedColor },
                      ]}
                    >
                      {t("admin.settings.emailSettings.none")}
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={settingsStyles.fieldRow}>
              <View style={[settingsStyles.field, settingsStyles.fieldFlex]}>
                <ThemedText style={settingsStyles.fieldLabel}>
                  {t("admin.settings.emailSettings.usernameLabel")}
                </ThemedText>
                <Input
                  value={username}
                  onChangeText={setUsername}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                />
              </View>

              <View style={[settingsStyles.field, settingsStyles.fieldFlex]}>
                <ThemedText style={settingsStyles.fieldLabel}>
                  {t("admin.settings.emailSettings.passwordLabel")}
                </ThemedText>
                <View style={styles.passwordRow}>
                  <View style={styles.passwordInput}>
                    <Input
                      key={showPassword ? "pw-visible" : "pw-hidden"}
                      value={password}
                      onChangeText={setPassword}
                      placeholder={t("admin.settings.emailSettings.passwordPlaceholder")}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                  </View>
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    style={styles.passwordToggle}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword
                        ? t("admin.settings.emailSettings.hidePassword")
                        : t("admin.settings.emailSettings.showPassword")
                    }
                    accessibilityState={{ expanded: showPassword }}
                  >
                    <Icon
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size="xl"
                      color={mutedColor}
                    />
                  </Pressable>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.connectionBlock}>
            <SubLabel mutedColor={mutedColor}>
              {t("admin.settings.emailSettings.senderIdentityLabel")}
            </SubLabel>
            <View style={settingsStyles.fieldRow}>
              <View style={[settingsStyles.field, settingsStyles.fieldFlex]}>
                <ThemedText style={settingsStyles.fieldLabel}>
                  {t("admin.settings.emailSettings.fromNameLabel")}
                </ThemedText>
                <Input value={fromName} onChangeText={setFromName} placeholder="OpenResto" />
              </View>
              <View style={[settingsStyles.field, settingsStyles.fieldFlex]}>
                <ThemedText style={settingsStyles.fieldLabel}>
                  {t("admin.settings.emailSettings.fromEmailLabel")}
                </ThemedText>
                <Input
                  value={fromEmail}
                  onChangeText={setFromEmail}
                  placeholder="noreply@site.com"
                  autoCapitalize="none"
                />
              </View>
            </View>
          </View>

          <BookingConfirmationToggle
            sendConfirmations={sendConfirmations}
            confirmDisabled={confirmDisabled}
            onToggle={toggleConfirmations}
            borderColor={borderColor}
            mutedColor={mutedColor}
            primaryColor={primaryColor}
            cardBg={cardBg}
            surface2={surface2}
            accentSoft={accentSoft}
          />

          {saveMsg && (
            <View
              style={[
                settingsStyles.successBanner,
                styles.saveBanner,
                {
                  backgroundColor: saveMsg.ok
                    ? `${theme.colors.success}10`
                    : `${theme.colors.warning}10`,
                  borderColor: saveMsg.ok
                    ? `${theme.colors.success}30`
                    : `${theme.colors.warning}30`,
                },
              ]}
            >
              <Icon
                name={saveMsg.ok ? "checkmark-circle" : "warning-outline"}
                size="md"
                color={saveMsg.ok ? theme.colors.success : theme.colors.warning}
              />
              <ThemedText
                style={[
                  saveMsg.ok ? settingsStyles.successText : settingsStyles.statusText,
                  styles.saveBannerText,
                  { color: saveMsg.ok ? theme.colors.success : theme.colors.warning },
                ]}
              >
                {saveMsg.text}
              </ThemedText>
            </View>
          )}

          <View style={[styles.footer, { borderTopColor: borderColor }]}>
            <ThemedText
              style={[settingsStyles.statusText, styles.footerHint, { color: mutedColor }]}
            >
              {testState === "ok"
                ? t("admin.settings.emailSettings.footerHintVerified")
                : t("admin.settings.emailSettings.footerHintUnverified")}
            </ThemedText>
            <ButtonRow>
              <Button
                size="md"
                onPress={handleSave}
                disabled={saving || !host || !username}
                loading={saving}
              >
                {saving
                  ? t("admin.settings.emailSettings.saving")
                  : t("admin.settings.emailSettings.saveButton")}
              </Button>
            </ButtonRow>
          </View>
        </View>
      </AnimatedAccordion>
    </View>
  );
}
