import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { View, Pressable, useWindowDimensions } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { Ionicons } from "@expo/vector-icons";
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
import { styles } from "./settings.styles";
import { SubLabel } from "./settingsShared";
import { SmtpTestPanel } from "./SmtpTestPanel";
import { BookingConfirmationToggle } from "./BookingConfirmationToggle";
import { EmailFailuresList } from "./EmailFailuresList";

// Design CSS var mappings:
// --surface   = cardBg
// --surface-2 = surface2  (slightly recessed, used for card backgrounds inside cards)
// --accent    = primaryColor
// --ink-3     = mutedColor
// --border    = borderColor

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
  // surface-2: the slightly recessed inner surface (used inside cards)
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

  // ── Provider grid ──────────────────────────────────────────
  const providerGrid = (
    <View style={{ gap: 8 }}>
      <SubLabel mutedColor={mutedColor}>Provider</SubLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {PROVIDERS.map((p) => {
          const on = activeProviderId === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => handleSelectProvider(p)}
              style={[
                {
                  flex: 1,
                  minWidth: 130,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 12,
                  paddingHorizontal: 14,
                  gap: 4,
                  borderColor: on ? primaryColor : borderColor,
                  backgroundColor: on ? cardBg : surface2,
                  position: "relative" as const,
                  // Ring shadow when active
                },
                on && {
                  shadowColor: primaryColor,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.3,
                  shadowRadius: 6,
                  elevation: 4,
                },
              ]}
            >
              {/* Icon box */}
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: on ? accentSoft : cardBg,
                  borderWidth: on ? 0 : 1,
                  borderColor,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 4,
                }}
              >
                <Ionicons name={p.icon} size={15} color={on ? primaryColor : mutedColor} />
              </View>
              <ThemedText style={{ fontSize: 13.5, fontWeight: "600" }}>{p.name}</ThemedText>
              <ThemedText style={{ fontSize: 11.5, color: mutedColor }}>{p.hint}</ThemedText>
              {on && (
                <View
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: primaryColor,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="checkmark" size={11} color="#fff" />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  // ── Connection form (left column) ──────────────────────────
  const connectionForm = (
    <View style={{ gap: 6 }}>
      <SubLabel mutedColor={mutedColor}>Connection</SubLabel>

      <View style={styles.field}>
        <ThemedText style={styles.fieldLabel}>SMTP Host</ThemedText>
        <Input
          value={host}
          onChangeText={setHost}
          placeholder="smtp.gmail.com"
          autoCapitalize="none"
        />
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
        <View style={[styles.field, { flex: 1 }]}>
          <ThemedText style={styles.fieldLabel}>Port</ThemedText>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <View style={{ width: 80 }}>
              <Input value={port} onChangeText={setPort} placeholder="587" keyboardType="numeric" />
            </View>
            <View style={{ flexDirection: "row", gap: 4, flex: 1 }}>
              {PORT_PRESETS.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setPort(String(p))}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: port === String(p) ? borderStrong : borderColor,
                    backgroundColor: port === String(p) ? cardBg : surface2,
                  }}
                >
                  <ThemedText
                    style={{
                      fontSize: 12,
                      color: port === String(p) ? textColor : mutedColor,
                    }}
                  >
                    {p}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.field, { marginTop: 4 }]}>
        <ThemedText style={styles.fieldLabel}>Encryption</ThemedText>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {/* SSL/TLS pill */}
          <Pressable
            onPress={() => setEnableSsl(true)}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingVertical: 9,
              paddingHorizontal: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: enableSsl ? okBorder : borderColor,
              backgroundColor: enableSsl ? okSoft : surface2,
            }}
          >
            <Ionicons name="shield-checkmark" size={13} color={enableSsl ? okColor : mutedColor} />
            <ThemedText
              style={{
                fontSize: 13,
                fontWeight: enableSsl ? "500" : "400",
                color: enableSsl ? okColor : mutedColor,
              }}
            >
              SSL/TLS
            </ThemedText>
          </Pressable>
          {/* None pill */}
          <Pressable
            onPress={() => setEnableSsl(false)}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 9,
              paddingHorizontal: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: !enableSsl ? borderStrong : borderColor,
              backgroundColor: !enableSsl ? cardBg : surface2,
            }}
          >
            <ThemedText
              style={{
                fontSize: 13,
                fontWeight: !enableSsl ? "500" : "400",
                color: !enableSsl ? textColor : mutedColor,
              }}
            >
              None
            </ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={[styles.field, { marginTop: 4 }]}>
        <ThemedText style={styles.fieldLabel}>Username</ThemedText>
        <Input
          value={username}
          onChangeText={setUsername}
          placeholder="you@example.com"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.field}>
        <ThemedText style={styles.fieldLabel}>Password</ThemedText>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Input
              key={showPassword ? "pw-visible" : "pw-hidden"}
              value={password}
              onChangeText={setPassword}
              placeholder="SMTP password or app token"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
          </View>
          <Pressable onPress={() => setShowPassword((v) => !v)} style={{ padding: 8 }}>
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={mutedColor}
            />
          </Pressable>
        </View>
      </View>

      <View style={{ height: 8 }} />
      <SubLabel mutedColor={mutedColor}>Sender identity</SubLabel>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={[styles.field, { flex: 1 }]}>
          <ThemedText style={styles.fieldLabel}>From name</ThemedText>
          <Input value={fromName} onChangeText={setFromName} placeholder="OpenResto" />
        </View>
        <View style={[styles.field, { flex: 1 }]}>
          <ThemedText style={styles.fieldLabel}>From email</ThemedText>
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

  // ── Right column: Status → Confirmations ──────────────────
  const rightColumn = (
    <View style={{ gap: 14 }}>
      <SubLabel mutedColor={mutedColor}>Status</SubLabel>

      {/* Test panel (decomposed into <SmtpTestPanel/>) */}
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

      {/* Booking confirmation toggle (decomposed into <BookingConfirmationToggle/>) */}
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

      {/* Send failures (decomposed into <EmailFailuresList/>) */}
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
    <View style={[styles.secCard, { backgroundColor: cardBg, borderColor }]}>
      {/* Collapsible header */}
      <Pressable style={styles.secHeader} onPress={() => setExpanded((v) => !v)}>
        <View style={[styles.secIcon, { backgroundColor: accentSoft }]}>
          <Ionicons name="mail-outline" size={20} color={primaryColor} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.secTitle}>Email (SMTP)</ThemedText>
          <ThemedText style={[styles.secSub, { color: mutedColor }]}>
            {isConfigured ? `Connected · ${host}` : "Setup required"}
          </ThemedText>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={mutedColor} />
      </Pressable>

      <AnimatedAccordion expanded={expanded}>
        <View style={[styles.secForm, { borderTopColor: borderColor, gap: 20 }]}>
          {/* Provider grid */}
          {providerGrid}

          {/* Two-column split (or stacked on narrow) */}
          <View
            style={
              isWide ? { flexDirection: "row", gap: 22, alignItems: "flex-start" } : { gap: 20 }
            }
          >
            <View style={isWide ? { flex: 1 } : undefined}>{connectionForm}</View>
            <View style={isWide ? { width: 340 } : undefined}>{rightColumn}</View>
          </View>

          {/* Status message */}
          {saveMsg && (
            <View
              style={[
                styles.successBanner,
                {
                  backgroundColor: saveMsg.ok
                    ? `${theme.colors.success}10`
                    : `${theme.colors.warning}10`,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: saveMsg.ok
                    ? `${theme.colors.success}30`
                    : `${theme.colors.warning}30`,
                  padding: 10,
                },
              ]}
            >
              <Ionicons
                name={saveMsg.ok ? "checkmark-circle" : "warning-outline"}
                size={16}
                color={saveMsg.ok ? theme.colors.success : theme.colors.warning}
              />
              <ThemedText
                style={[
                  saveMsg.ok ? styles.successText : styles.secBtnText,
                  { flex: 1, color: saveMsg.ok ? theme.colors.success : theme.colors.warning },
                ]}
              >
                {saveMsg.text}
              </ThemedText>
            </View>
          )}

          {/* Save bar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingTop: 14,
              borderTopWidth: 1,
              borderTopColor: borderColor,
              borderStyle: "dashed",
            }}
          >
            <ThemedText style={[styles.secBtnText, { color: mutedColor, fontSize: 12, flex: 1 }]}>
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
