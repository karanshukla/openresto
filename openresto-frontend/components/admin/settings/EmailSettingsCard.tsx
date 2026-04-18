import { useState, useEffect } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/theme/theme";
import { getEmailSettings, saveEmailSettings, testEmailConnection } from "@/api/admin";
import { useBrand } from "@/context/BrandContext";
import { styles } from "./settings.styles";

const PRESETS: { label: string; host: string; port: number }[] = [
  { label: "Gmail", host: "smtp.gmail.com", port: 587 },
  { label: "Outlook", host: "smtp-mail.outlook.com", port: 587 },
];

export function EmailSettingsCard({
  borderColor,
  mutedColor,
  cardBg,
}: {
  borderColor: string;
  mutedColor: string;
  cardBg: string;
}) {
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [enableSsl, setEnableSsl] = useState(true);
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const brand = useBrand();
  const primaryColor = brand.primaryColor || COLORS.primary;

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
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    const result = await saveEmailSettings({
      host,
      port: parseInt(port, 10) || 587,
      username,
      password,
      enableSsl,
      fromName: fromName || undefined,
      fromEmail: fromEmail || undefined,
    });
    setSaving(false);
    if (result) {
      setMsg({ text: result.message, ok: true });
      setIsConfigured(true);
    } else {
      setMsg({ text: "Failed to save.", ok: false });
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMsg(null);
    await saveEmailSettings({
      host,
      port: parseInt(port, 10) || 587,
      username,
      password,
      enableSsl,
      fromName: fromName || undefined,
      fromEmail: fromEmail || undefined,
    });
    setIsConfigured(true);
    const result = await testEmailConnection();
    setTesting(false);
    setMsg({ text: result.message, ok: result.ok });
  };

  return (
    <View style={[styles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <Pressable style={styles.secHeader} onPress={() => setExpanded((v) => !v)}>
        <View style={[styles.secIcon, { backgroundColor: `${primaryColor}14` }]}>
          <Ionicons name="mail-outline" size={20} color={primaryColor} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.secTitle}>Email (SMTP)</ThemedText>
          <ThemedText style={[styles.secSub, { color: mutedColor }]}>
            {isConfigured ? `Connected via ${host}` : "Not configured"}
          </ThemedText>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={mutedColor} />
      </Pressable>

      {expanded && (
        <View style={[styles.secForm, { borderTopColor: borderColor, gap: 16 }]}>
          <View>
            <ThemedText style={[styles.fieldLabel, { marginBottom: 8, opacity: 0.6 }]}>
              QUICK PRESETS
            </ThemedText>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {PRESETS.map((p) => (
                <Pressable
                  key={p.label}
                  style={[
                    styles.dayChip,
                    {
                      borderColor,
                      backgroundColor: host === p.host ? `${primaryColor}15` : "transparent",
                    },
                    host === p.host && { borderColor: primaryColor },
                  ]}
                  onPress={() => {
                    setHost(p.host);
                    setPort(String(p.port));
                    setEnableSsl(true);
                  }}
                >
                  <ThemedText
                    style={[
                      styles.secBtnText,
                      { color: host === p.host ? primaryColor : mutedColor },
                    ]}
                  >
                    {p.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ gap: 12 }}>
            <ThemedText style={styles.editorSectionTitle}>Server Settings</ThemedText>

            <View style={styles.field}>
              <ThemedText style={styles.fieldLabel}>SMTP Host</ThemedText>
              <Input value={host} onChangeText={setHost} placeholder="smtp.gmail.com" />
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={[styles.field, { flex: 1 }]}>
                <ThemedText style={styles.fieldLabel}>Port</ThemedText>
                <Input
                  value={port}
                  onChangeText={setPort}
                  placeholder="587"
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <ThemedText style={styles.fieldLabel}>Security</ThemedText>
                <Pressable
                  style={[
                    styles.secBtn,
                    {
                      borderColor: enableSsl ? primaryColor : borderColor,
                      backgroundColor: enableSsl ? `${primaryColor}10` : "transparent",
                      alignItems: "center" as const,
                      flexDirection: "row",
                      gap: 8,
                      paddingHorizontal: 12,
                    },
                  ]}
                  onPress={() => setEnableSsl((v) => !v)}
                >
                  <Ionicons
                    name={enableSsl ? "shield-checkmark" : "shield-outline"}
                    size={16}
                    color={enableSsl ? primaryColor : mutedColor}
                  />
                  <ThemedText
                    style={[
                      styles.secBtnText,
                      {
                        color: enableSsl ? primaryColor : mutedColor,
                        fontWeight: enableSsl ? "600" : "400",
                      },
                    ]}
                  >
                    {enableSsl ? "SSL/TLS Enabled" : "No Encryption"}
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <ThemedText style={styles.fieldLabel}>Username</ThemedText>
              <Input
                value={username}
                onChangeText={setUsername}
                placeholder="your@email.com"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.field}>
              <ThemedText style={styles.fieldLabel}>Password</ThemedText>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Input
                    value={password}
                    onChangeText={setPassword}
                    placeholder="SMTP Password"
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
          </View>

          <View style={{ gap: 12, marginTop: 4 }}>
            <ThemedText style={styles.editorSectionTitle}>Sender Identity</ThemedText>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={[styles.field, { flex: 1 }]}>
                <ThemedText style={styles.fieldLabel}>From Name</ThemedText>
                <Input value={fromName} onChangeText={setFromName} placeholder="OpenResto" />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <ThemedText style={styles.fieldLabel}>From Email</ThemedText>
                <Input
                  value={fromEmail}
                  onChangeText={setFromEmail}
                  placeholder="noreply@site.com"
                  autoCapitalize="none"
                />
              </View>
            </View>
          </View>

          {msg && (
            <View
              style={[
                styles.successBanner,
                {
                  backgroundColor: msg.ok ? `${COLORS.success}10` : `${COLORS.error}10`,
                  borderRadius: 8,
                  marginTop: 8,
                },
              ]}
            >
              <Ionicons
                name={msg.ok ? "checkmark-circle" : "alert-circle"}
                size={18}
                color={msg.ok ? COLORS.success : COLORS.error}
              />
              <ThemedText style={[msg.ok ? styles.successText : styles.errorText, { padding: 8 }]}>
                {msg.text}
              </ThemedText>
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
            <Button
              onPress={handleSave}
              disabled={saving || !host || !username}
              style={{ flex: 1 }}
            >
              {saving ? "Saving…" : "Save Settings"}
            </Button>
            <Pressable
              style={[
                styles.secBtn,
                { borderColor, flexDirection: "row", gap: 8, paddingHorizontal: 16 },
                (!host || !username) && { opacity: 0.4 },
              ]}
              onPress={() => {
                if (testing || !host || !username) return;
                handleTest();
              }}
            >
              <Ionicons name="flash-outline" size={16} color={primaryColor} />
              <ThemedText style={[styles.secBtnText, { color: primaryColor }]}>
                {testing ? "Testing…" : "Test Connection"}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
