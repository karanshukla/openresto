import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { View, Pressable, useWindowDimensions } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { theme, getThemeColors } from "@/theme/theme";
import {
  getEmailSettings,
  saveEmailSettings,
  testEmailConnection,
  getEmailFailures,
  type EmailFailureDto,
} from "@/api/admin";
import { useAppTheme } from "@/hooks/use-app-theme";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { styles as settingsStyles } from "./settings.styles";
import { styles } from "./EmailSettingsCard.styles";
import { SubLabel } from "./settingsShared";
import { SmtpTestPanel } from "./SmtpTestPanel";
import { BookingConfirmationToggle } from "./BookingConfirmationToggle";
import { EmailFailuresList } from "./EmailFailuresList";
import { Icon } from "@/components/common/Icon";

const PROVIDERS = [
  {
    id: "gmail",
    name: "Gmail",
    host: "smtp.gmail.com",
    port: 587,
    hint: "Use an app password",
    icon: "mail-outline" as const,
  },
  {
    id: "outlook",
    name: "Outlook 365",
    host: "smtp.office365.com",
    port: 587,
    hint: "Modern auth",
    icon: "mail-open-outline" as const,
  },
  {
    id: "custom",
    name: "Custom SMTP",
    host: "",
    port: 587,
    hint: "Your own host",
    icon: "cog-outline" as const,
  },
];

const PORT_PRESETS = [25, 465, 587, 2525];

type TestState = "idle" | "testing" | "ok" | "fail";

export function EmailSettingsCard({
  borderColor,
  mutedColor,
  cardBg,
  isDark,
}: {
  borderColor: string;
  mutedColor: string;
  cardBg: string;
  isDark: boolean;
}) {
  const { text: textColor } = getThemeColors(isDark);
  const surface2 = isDark ? "#252729" : "#f9fafb";
  const borderStrong = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)";
  const okColor = theme.colors.success;
  const okSoft = isDark ? `${okColor}22` : "#dcfce7";
  const okBorder = `${okColor}50`;
  const dangerColor = theme.colors.error;
  const dangerSoft = isDark ? `${dangerColor}22` : "#fef2f2";
  const dangerBorder = `${dangerColor}50`;

  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [enableSsl, setEnableSsl] = useState(true);
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [testState, setTestState] = useState<TestState>("idle");
  const [testMsg, setTestMsg] = useState("");
  const [saveMsg, setSaveMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [expanded, setExpanded] = usePersistedState("settings:email:expanded", true);
  const [sendConfirmations, setSendConfirmations] = useState(false);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [failures, setFailures] = useState<EmailFailureDto[]>([]);

  const { primaryColor } = useAppTheme();
  const accentSoft = `${primaryColor}18`;

  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  useEffect(() => {
    getEmailSettings().then((s) => {
      setHost(s.host);
      setPort(String(s.port));
      setUsername(s.username);
      setPassword(s.password);
      setEnableSsl(s.enableSsl);
      setFromName(s.fromName ?? "");
      setFromEmail(s.fromEmail ?? "");
      setIsConfigured(s.isConfigured);
      setSendConfirmations(s.sendBookingConfirmations ?? false);
      if (s.isConfigured) setTestState("ok");
      const matched = PROVIDERS.find((p) => p.host && p.host === s.host);
      if (matched) setActiveProviderId(matched.id);
    });
    getEmailFailures().then(setFailures);
  }, []);

  const handleSelectProvider = (p: (typeof PROVIDERS)[0]) => {
    setActiveProviderId(p.id);
    if (p.host) setHost(p.host);
    setPort(String(p.port));
    setEnableSsl(true);
  };

  const buildPayload = () => ({
    host,
    port: parseInt(port, 10) || 587,
    username,
    password,
    enableSsl,
    fromName: fromName || undefined,
    fromEmail: fromEmail || undefined,
    sendBookingConfirmations: sendConfirmations,
  });

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    const result = await saveEmailSettings(buildPayload());
    setSaving(false);
    if (result) {
      setSaveMsg({ text: result.message, ok: true });
      setIsConfigured(true);
    } else {
      setSaveMsg({ text: "Failed to save.", ok: false });
    }
  };

  const handleTest = async () => {
    setTestState("testing");
    setTestMsg("");
    await saveEmailSettings(buildPayload());
    setIsConfigured(true);
    const result = await testEmailConnection();
    setTestState(result.ok ? "ok" : "fail");
    setTestMsg(result.message);
  };

  const confirmDisabled = !isConfigured && testState !== "ok";

  const providerGrid = (
    <View style={styles.providerBlock}>
      <SubLabel mutedColor={mutedColor}>Provider</SubLabel>
      <View style={styles.providerGrid}>
        {PROVIDERS.map((p) => {
          const on = activeProviderId === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => handleSelectProvider(p)}
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
              <ThemedText style={[styles.providerHint, { color: mutedColor }]}>{p.hint}</ThemedText>
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
  );

  const connectionForm = (
    <View style={styles.connectionBlock}>
      <SubLabel mutedColor={mutedColor}>Connection</SubLabel>

      <View style={settingsStyles.field}>
        <ThemedText style={settingsStyles.fieldLabel}>SMTP Host</ThemedText>
        <Input
          value={host}
          onChangeText={setHost}
          placeholder="smtp.gmail.com"
          autoCapitalize="none"
        />
      </View>

      <View style={[styles.fieldRow, styles.fieldRowSpaced]}>
        <View style={[settingsStyles.field, styles.fieldFlex]}>
          <ThemedText style={settingsStyles.fieldLabel}>Port</ThemedText>
          <View style={styles.portRow}>
            <View style={styles.portInput}>
              <Input value={port} onChangeText={setPort} placeholder="587" keyboardType="numeric" />
            </View>
            <View style={styles.portPresets}>
              {PORT_PRESETS.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setPort(String(p))}
                  accessibilityRole="radio"
                  accessibilityLabel={`Use port ${p}`}
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
      </View>

      <View style={[settingsStyles.field, styles.fieldSpaced]}>
        <ThemedText style={settingsStyles.fieldLabel}>Encryption</ThemedText>
        <View style={styles.encryptionRow}>
          <Pressable
            onPress={() => setEnableSsl(true)}
            accessibilityRole="radio"
            accessibilityLabel="SSL/TLS encryption"
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
            <Icon name="shield-checkmark" size={13} color={enableSsl ? okColor : mutedColor} />
            <ThemedText
              style={[
                styles.encryptionLabel,
                enableSsl && styles.encryptionLabelOn,
                { color: enableSsl ? okColor : mutedColor },
              ]}
            >
              SSL/TLS
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setEnableSsl(false)}
            accessibilityRole="radio"
            accessibilityLabel="No encryption"
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
              None
            </ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={[settingsStyles.field, styles.fieldSpaced]}>
        <ThemedText style={settingsStyles.fieldLabel}>Username</ThemedText>
        <Input
          value={username}
          onChangeText={setUsername}
          placeholder="you@example.com"
          autoCapitalize="none"
        />
      </View>

      <View style={settingsStyles.field}>
        <ThemedText style={settingsStyles.fieldLabel}>Password</ThemedText>
        <View style={styles.passwordRow}>
          <View style={styles.passwordInput}>
            <Input
              key={showPassword ? "pw-visible" : "pw-hidden"}
              value={password}
              onChangeText={setPassword}
              placeholder="SMTP password or app token"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
          </View>
          <Pressable
            onPress={() => setShowPassword((v) => !v)}
            style={styles.passwordToggle}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? "Hide password" : "Show password"}
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

      <View style={styles.blockGap} />
      <SubLabel mutedColor={mutedColor}>Sender identity</SubLabel>

      <View style={styles.fieldRow}>
        <View style={[settingsStyles.field, styles.fieldFlex]}>
          <ThemedText style={settingsStyles.fieldLabel}>From name</ThemedText>
          <Input value={fromName} onChangeText={setFromName} placeholder="OpenResto" />
        </View>
        <View style={[settingsStyles.field, styles.fieldFlex]}>
          <ThemedText style={settingsStyles.fieldLabel}>From email</ThemedText>
          <Input
            value={fromEmail}
            onChangeText={setFromEmail}
            placeholder="noreply@site.com"
            autoCapitalize="none"
          />
        </View>
      </View>
    </View>
  );

  const rightColumn = (
    <View style={styles.rightColumn}>
      <SubLabel mutedColor={mutedColor}>Status</SubLabel>

      <SmtpTestPanel
        testState={testState}
        host={host}
        port={port}
        testMsg={testMsg}
        username={username}
        onTest={handleTest}
        borderColor={borderColor}
        mutedColor={mutedColor}
        primaryColor={primaryColor}
        cardBg={cardBg}
        surface2={surface2}
        okColor={okColor}
        okSoft={okSoft}
        okBorder={okBorder}
        dangerColor={dangerColor}
        dangerSoft={dangerSoft}
        dangerBorder={dangerBorder}
      />

      <BookingConfirmationToggle
        sendConfirmations={sendConfirmations}
        confirmDisabled={confirmDisabled}
        onToggle={(next) => {
          setSendConfirmations(next);
          if (next)
            setSaveMsg({
              text: "Emails will be sent using your SMTP account. Save to apply.",
              ok: false,
            });
        }}
        borderColor={borderColor}
        mutedColor={mutedColor}
        primaryColor={primaryColor}
        cardBg={cardBg}
        surface2={surface2}
        accentSoft={accentSoft}
      />

      <EmailFailuresList
        failures={failures}
        mutedColor={mutedColor}
        dangerBorder={dangerBorder}
        dangerSoft={dangerSoft}
        dangerColor={dangerColor}
      />
    </View>
  );

  return (
    <View style={[settingsStyles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <Pressable
        style={settingsStyles.secHeader}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="Email (SMTP)"
        accessibilityState={{ expanded }}
      >
        <View style={[settingsStyles.secIcon, { backgroundColor: accentSoft }]}>
          <Icon name="mail-outline" size="xl" color={primaryColor} />
        </View>
        <View style={settingsStyles.secHeaderCopy}>
          <ThemedText style={settingsStyles.secTitle}>Email (SMTP)</ThemedText>
          <ThemedText style={[settingsStyles.secSub, { color: mutedColor }]}>
            {isConfigured ? `Connected · ${host}` : "Setup required"}
          </ThemedText>
        </View>
        <Icon name={expanded ? "chevron-up" : "chevron-down"} size="lg" color={mutedColor} />
      </Pressable>

      <AnimatedAccordion expanded={expanded}>
        <View style={[settingsStyles.secForm, styles.form, { borderTopColor: borderColor }]}>
          {providerGrid}

          <View style={isWide ? styles.columnsWide : styles.columnsNarrow}>
            <View style={isWide ? styles.fieldFlex : undefined}>{connectionForm}</View>
            <View style={isWide ? styles.rightColumnWide : undefined}>{rightColumn}</View>
          </View>

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
                  saveMsg.ok ? settingsStyles.successText : settingsStyles.secBtnText,
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
              style={[settingsStyles.secBtnText, styles.footerHint, { color: mutedColor }]}
            >
              {testState === "ok"
                ? "Connection verified · confirmations ready"
                : "Test the connection before enabling confirmations"}
            </ThemedText>
            <Button onPress={handleSave} disabled={saving || !host || !username}>
              {saving ? "Saving…" : "Save SMTP settings"}
            </Button>
          </View>
        </View>
      </AnimatedAccordion>
    </View>
  );
}
