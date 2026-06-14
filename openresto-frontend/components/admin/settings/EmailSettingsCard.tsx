import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { View, Pressable, useWindowDimensions } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, getThemeColors } from "@/theme/theme";
import {
  getEmailSettings,
  saveEmailSettings,
  testEmailConnection,
  getEmailFailures,
  type EmailFailureDto,
} from "@/api/admin";
import { useBrand } from "@/context/BrandContext";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { styles } from "./settings.styles";

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

function SubLabel({ children, mutedColor }: { children: string; mutedColor: string }) {
  return (
    <ThemedText
      style={{
        fontFamily: "monospace" as const,
        fontSize: 10,
        textTransform: "uppercase" as const,
        letterSpacing: 1,
        color: mutedColor,
        fontWeight: "600" as const,
        marginBottom: 10,
      }}
    >
      {children}
    </ThemedText>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  primaryColor,
  borderColor,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  primaryColor: string;
  borderColor: string;
}) {
  return (
    <Pressable
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onPress={() => !disabled && onChange(!checked)}
      style={[
        {
          width: 34,
          height: 20,
          borderRadius: 999,
          backgroundColor: checked ? primaryColor : borderColor,
          padding: 2,
          justifyContent: "center" as const,
          flexShrink: 0,
        },
        disabled && { opacity: 0.5 },
      ]}
    >
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: "white",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.18,
          shadowRadius: 1,
          transform: [{ translateX: checked ? 14 : 0 }],
        }}
      />
    </Pressable>
  );
}

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
  const okColor = COLORS.success;
  const okSoft = isDark ? `${okColor}22` : "#dcfce7";
  const okBorder = `${okColor}50`;
  const dangerColor = COLORS.error;
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

  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;
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

      {/* Test panel: indicator | title+desc | button — single row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          padding: 14,
          paddingHorizontal: 16,
          borderWidth: 1,
          borderRadius: 12,
          borderColor:
            testState === "ok" ? okBorder : testState === "fail" ? dangerBorder : borderColor,
          backgroundColor:
            testState === "ok" ? okSoft : testState === "fail" ? dangerSoft : surface2,
        }}
      >
        {/* Circular indicator */}
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            borderWidth: 1,
            borderColor:
              testState === "ok" ? okColor : testState === "fail" ? dangerColor : borderColor,
            backgroundColor:
              testState === "ok" ? okColor : testState === "fail" ? dangerColor : cardBg,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {testState === "idle" && (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: mutedColor }} />
          )}
          {testState === "testing" && (
            <Ionicons name="reload-outline" size={14} color={mutedColor} />
          )}
          {testState === "ok" && <Ionicons name="checkmark" size={16} color="#fff" />}
          {testState === "fail" && (
            <ThemedText style={{ fontSize: 18, fontWeight: "700", color: "#fff", lineHeight: 20 }}>
              ×
            </ThemedText>
          )}
        </View>

        {/* Text */}
        <View style={{ flex: 1 }}>
          <ThemedText
            style={{
              fontSize: 13.5,
              fontWeight: "600",
            }}
          >
            {testState === "idle" && "Not yet tested"}
            {testState === "testing" && "Testing connection…"}
            {testState === "ok" && "Connection successful"}
            {testState === "fail" && "Connection failed"}
          </ThemedText>
          <ThemedText style={{ fontSize: 12, color: mutedColor, marginTop: 2 }}>
            {testState === "idle" && "Send a test to verify settings before going live."}
            {testState === "testing" && `Reaching ${host || "host"}:${port}…`}
            {testState === "ok" && (testMsg || "Authentication accepted. Test email delivered.")}
            {testState === "fail" && (testMsg || "Check your credentials and try again.")}
          </ThemedText>
        </View>

        {/* Button */}
        <Pressable
          onPress={() => {
            if (testState !== "testing" && host && username) handleTest();
          }}
          style={[
            styles.secBtn,
            { flexDirection: "row", gap: 6, paddingHorizontal: 14, borderColor, flexShrink: 0 },
            (!host || !username) && { opacity: 0.4 },
          ]}
        >
          <Ionicons name="flash-outline" size={14} color={primaryColor} />
          <ThemedText style={[styles.secBtnText, { color: primaryColor }]}>
            {testState === "testing" ? "Testing…" : testState === "ok" ? "Re-test" : "Send test"}
          </ThemedText>
        </Pressable>
      </View>

      {/* Booking confirmation toggle */}
      <View style={{ gap: 8 }}>
        <SubLabel mutedColor={mutedColor}>Booking confirmations</SubLabel>
        <View
          style={[
            {
              borderWidth: 1,
              borderColor,
              borderRadius: 12,
              overflow: "hidden",
              backgroundColor: surface2,
            },
            confirmDisabled && { opacity: 0.65 },
          ]}
        >
          <Pressable
            onPress={() => {
              if (confirmDisabled) return;
              const next = !sendConfirmations;
              setSendConfirmations(next);
              if (next)
                setSaveMsg({
                  text: "Emails will be sent using your SMTP account. Save to apply.",
                  ok: false,
                });
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              padding: 12,
              paddingHorizontal: 14,
            }}
          >
            {/* Icon box */}
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                backgroundColor: cardBg,
                borderWidth: 1,
                borderColor,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="mail-outline" size={14} color={mutedColor} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <ThemedText style={{ fontSize: 14, fontWeight: "500" }}>
                  Booking confirmation
                </ThemedText>
                <View
                  style={{
                    backgroundColor: accentSoft,
                    borderRadius: 999,
                    paddingHorizontal: 7,
                    paddingVertical: 2,
                  }}
                >
                  <ThemedText
                    style={{
                      fontSize: 10,
                      color: primaryColor,
                      fontWeight: "600",
                      letterSpacing: 0.6,
                    }}
                  >
                    REC
                  </ThemedText>
                </View>
              </View>
              <ThemedText style={{ fontSize: 12.5, color: mutedColor, marginTop: 2 }}>
                Sent the moment a guest books a table.
              </ThemedText>
            </View>
            <ToggleSwitch
              checked={sendConfirmations}
              onChange={(v) => {
                if (confirmDisabled) return;
                setSendConfirmations(v);
                if (v)
                  setSaveMsg({
                    text: "Emails will be sent using your SMTP account. Save to apply.",
                    ok: false,
                  });
              }}
              disabled={confirmDisabled}
              primaryColor={primaryColor}
              borderColor={borderColor}
            />
          </Pressable>
          {confirmDisabled && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                padding: 10,
                paddingHorizontal: 14,
                borderTopWidth: 1,
                borderTopColor: borderColor,
                backgroundColor: cardBg,
              }}
            >
              <Ionicons name="shield-outline" size={13} color={mutedColor} />
              <ThemedText style={{ fontSize: 12, color: mutedColor }}>
                Configure and test SMTP above to enable.
              </ThemedText>
            </View>
          )}
        </View>
      </View>

      {/* Send failures */}
      {failures.length > 0 && (
        <View style={{ gap: 8 }}>
          <SubLabel mutedColor={mutedColor}>Send failures</SubLabel>
          <View
            style={{
              borderWidth: 1,
              borderColor: dangerBorder,
              borderRadius: 12,
              overflow: "hidden",
              backgroundColor: dangerSoft,
            }}
          >
            {failures.map((f, i) => {
              const date = new Date(f.attemptedAt);
              const dateStr = date.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <View
                  key={f.id}
                  style={{
                    padding: 12,
                    paddingHorizontal: 14,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: dangerBorder,
                    gap: 3,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Ionicons name="warning-outline" size={13} color={dangerColor} />
                    <ThemedText
                      style={{ fontSize: 12.5, fontWeight: "500", flex: 1 }}
                      numberOfLines={1}
                    >
                      {f.recipientEmail}
                    </ThemedText>
                    <ThemedText style={{ fontSize: 11, color: mutedColor }}>{dateStr}</ThemedText>
                  </View>
                  {f.bookingRef && (
                    <ThemedText style={{ fontSize: 11.5, color: mutedColor, paddingLeft: 19 }}>
                      Ref: {f.bookingRef}
                    </ThemedText>
                  )}
                  <ThemedText
                    style={{ fontSize: 11.5, color: dangerColor, paddingLeft: 19 }}
                    numberOfLines={2}
                  >
                    {f.errorMessage}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        </View>
      )}
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
                  backgroundColor: saveMsg.ok ? `${COLORS.success}10` : `${COLORS.warning}10`,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: saveMsg.ok ? `${COLORS.success}30` : `${COLORS.warning}30`,
                  padding: 10,
                },
              ]}
            >
              <Ionicons
                name={saveMsg.ok ? "checkmark-circle" : "warning-outline"}
                size={16}
                color={saveMsg.ok ? COLORS.success : COLORS.warning}
              />
              <ThemedText
                style={[
                  saveMsg.ok ? styles.successText : styles.secBtnText,
                  { flex: 1, color: saveMsg.ok ? COLORS.success : COLORS.warning },
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
