import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { ButtonRow } from "@/components/common/ButtonRow";
import { theme } from "@/theme/theme";
import { validatePasswordChange } from "@/utils/validation";
import { getMyPvqStatus, setupPvq, changePassword, changeEmail, PvqStatus } from "@/api/auth";
import { useAuth } from "@/context/AuthContext";
import { useAppTheme } from "@/hooks/use-app-theme";
import { AnimatedAccordion } from "@/components/common/AnimatedAccordion";
import { styles } from "./settings.styles";
import { Icon } from "@/components/common/Icon";

export function SecurityCard({
  borderColor,
  mutedColor,
  cardBg,
}: {
  borderColor: string;
  mutedColor: string;
  cardBg: string;
}) {
  const [pvqStatus, setPvqStatus] = useState<PvqStatus | null>(null);
  const { user, setUser } = useAuth();
  const email = user?.email ?? null;
  const [showPvqForm, setShowPvqForm] = useState(false);
  const [showPwForm, setShowPwForm] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [pvqQuestion, setPvqQuestion] = useState("");
  const [pvqAnswer, setPvqAnswer] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [currentPwForEmail, setCurrentPwForEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [expanded, setExpanded] = usePersistedState("settings:security:expanded", true);

  const { primaryColor } = useAppTheme();

  // Identity comes from the auth context; only the security question still needs a fetch.
  useEffect(() => {
    getMyPvqStatus().then(setPvqStatus);
  }, []);

  const handleSavePvq = async () => {
    if (!pvqQuestion.trim() || !pvqAnswer.trim()) return;
    setSaving(true);
    const result = await setupPvq(pvqQuestion.trim(), pvqAnswer.trim());
    setSaving(false);
    setMsg({ text: result.message, ok: result.ok });
    if (result.ok) {
      setPvqStatus({ isConfigured: true, question: pvqQuestion.trim() });
      setShowPvqForm(false);
      setPvqQuestion("");
      setPvqAnswer("");
    }
  };

  const handleChangeEmail = async () => {
    setSaving(true);
    const result = await changeEmail(currentPwForEmail, newEmail.trim());
    setSaving(false);
    setMsg({ text: result.message, ok: result.ok });
    if (result.ok) {
      if (user) setUser({ ...user, email: result.email ?? newEmail.trim().toLowerCase() });
      setShowEmailForm(false);
      setNewEmail("");
      setCurrentPwForEmail("");
    }
  };

  const handleChangePw = async () => {
    const v = validatePasswordChange(newPw, confirmPw);
    if (!v.ok) {
      setMsg({ text: v.error, ok: false });
      return;
    }
    setSaving(true);
    const result = await changePassword(currentPw, newPw);
    setSaving(false);
    setMsg({ text: result.message, ok: result.ok });
    if (result.ok) {
      setShowPwForm(false);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    }
  };

  return (
    <View style={[styles.secCard, { backgroundColor: cardBg, borderColor }]} testID="security-card">
      <Pressable
        style={styles.secHeader}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="Account Security"
        accessibilityState={{ expanded }}
      >
        <View style={[styles.secIcon, { backgroundColor: `${primaryColor}14` }]}>
          <Icon name="shield-checkmark-outline" size="xl" color={primaryColor} />
        </View>
        <View style={styles.secHeaderCopy}>
          <ThemedText style={styles.secTitle}>Account Security</ThemedText>
          <ThemedText style={[styles.secSub, { color: mutedColor }]}>
            Manage your password and identity verification
          </ThemedText>
        </View>
        <Icon name={expanded ? "chevron-up" : "chevron-down"} size="lg" color={mutedColor} />
      </Pressable>

      <AnimatedAccordion expanded={expanded}>
        <>
          <View style={[styles.secRow, { borderTopColor: borderColor }]}>
            <View style={styles.secRowCopy}>
              <ThemedText style={styles.secRowTitle}>Email</ThemedText>
              <ThemedText style={[styles.secRowSub, { color: mutedColor }]} numberOfLines={1}>
                {email ?? "Loading…"}
              </ThemedText>
            </View>
            <Button
              testID="email-change-button"
              variant="secondary"
              size="md"
              accessibilityLabel="Change email address"
              accessibilityState={{ expanded: showEmailForm }}
              onPress={() => {
                setShowEmailForm((v) => !v);
                setShowPvqForm(false);
                setShowPwForm(false);
                setMsg(null);
              }}
            >
              Change
            </Button>
          </View>

          {showEmailForm && (
            <View style={[styles.secForm, { borderTopColor: borderColor }]}>
              <View style={styles.fieldRow}>
                <View style={[styles.field, styles.fieldFlex]}>
                  <ThemedText style={styles.fieldLabel}>New email</ThemedText>
                  <Input
                    value={newEmail}
                    onChangeText={setNewEmail}
                    placeholder="new@email.com"
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
                <View style={[styles.field, styles.fieldFlex]}>
                  <ThemedText style={styles.fieldLabel}>Current password</ThemedText>
                  <Input
                    value={currentPwForEmail}
                    onChangeText={setCurrentPwForEmail}
                    secureTextEntry
                    placeholder="••••••••"
                  />
                </View>
              </View>
              {msg && (
                <ThemedText style={msg.ok ? styles.successText : styles.errorText}>
                  {msg.text}
                </ThemedText>
              )}
              <ButtonRow style={styles.formActions}>
                <Button
                  variant="secondary"
                  tone="neutral"
                  size="md"
                  onPress={() => setShowEmailForm(false)}
                  accessibilityLabel="Cancel email change"
                >
                  Cancel
                </Button>
                <Button
                  size="md"
                  onPress={handleChangeEmail}
                  disabled={saving || !newEmail.trim() || !currentPwForEmail}
                >
                  {saving ? "Saving…" : "Update Email"}
                </Button>
              </ButtonRow>
            </View>
          )}

          <View style={[styles.secRow, { borderTopColor: borderColor }]}>
            <View style={[styles.secRowCopy, styles.policyHeaderCopy]}>
              <ThemedText style={styles.secRowTitle}>Security Question</ThemedText>
              {pvqStatus?.isConfigured ? (
                <ThemedText style={[styles.secRowSub, { color: mutedColor }]} numberOfLines={1}>
                  {pvqStatus.question}
                </ThemedText>
              ) : (
                <ThemedText style={[styles.secRowSub, { color: theme.colors.warning }]}>
                  Not configured. Set one up to enable password reset.
                </ThemedText>
              )}
            </View>
            <Button
              variant="secondary"
              size="md"
              accessibilityLabel="Change password recovery question"
              accessibilityState={{ expanded: showPvqForm }}
              onPress={() => {
                setShowPvqForm((v) => !v);
                setShowPwForm(false);
                setShowEmailForm(false);
                setMsg(null);
              }}
            >
              {pvqStatus?.isConfigured ? "Change" : "Set up"}
            </Button>
          </View>

          {showPvqForm && (
            <View style={[styles.secForm, { borderTopColor: borderColor }]}>
              <View style={styles.fieldRow}>
                <View style={[styles.field, styles.fieldFlex]}>
                  <ThemedText style={styles.fieldLabel}>Security question</ThemedText>
                  <Input
                    value={pvqQuestion}
                    onChangeText={setPvqQuestion}
                    placeholder="e.g. What was the name of your first pet?"
                  />
                </View>
                <View style={[styles.field, styles.fieldFlex]}>
                  <ThemedText style={styles.fieldLabel}>Answer (not case-sensitive)</ThemedText>
                  <Input
                    value={pvqAnswer}
                    onChangeText={setPvqAnswer}
                    placeholder="Your answer"
                    autoCapitalize="none"
                  />
                </View>
              </View>
              {msg && !msg.ok && <ThemedText style={styles.errorText}>{msg.text}</ThemedText>}
              <ButtonRow style={styles.formActions}>
                <Button
                  variant="secondary"
                  tone="neutral"
                  size="md"
                  onPress={() => setShowPvqForm(false)}
                  accessibilityLabel="Cancel recovery question change"
                >
                  Cancel
                </Button>
                <Button
                  size="md"
                  onPress={handleSavePvq}
                  disabled={saving || !pvqQuestion.trim() || !pvqAnswer.trim()}
                >
                  {saving ? "Saving…" : "Save Question"}
                </Button>
              </ButtonRow>
            </View>
          )}

          <View style={[styles.secRow, { borderTopColor: borderColor }]}>
            <View style={styles.secRowCopy}>
              <ThemedText style={styles.secRowTitle}>Password</ThemedText>
              <ThemedText style={[styles.secRowSub, { color: mutedColor }]}>
                Change your admin password
              </ThemedText>
            </View>
            <Button
              variant="secondary"
              size="md"
              accessibilityLabel="Change password"
              accessibilityState={{ expanded: showPwForm }}
              onPress={() => {
                setShowPwForm((v) => !v);
                setShowPvqForm(false);
                setShowEmailForm(false);
                setMsg(null);
              }}
            >
              Change
            </Button>
          </View>

          {showPwForm && (
            <View style={[styles.secForm, { borderTopColor: borderColor }]}>
              <View style={styles.field}>
                <ThemedText style={styles.fieldLabel}>Current password</ThemedText>
                <Input
                  value={currentPw}
                  onChangeText={setCurrentPw}
                  secureTextEntry
                  placeholder="••••••••"
                />
              </View>
              <View style={styles.fieldRow}>
                <View style={[styles.field, styles.fieldFlex]}>
                  <ThemedText style={styles.fieldLabel}>New password</ThemedText>
                  <Input
                    value={newPw}
                    onChangeText={setNewPw}
                    secureTextEntry
                    placeholder="At least 6 characters"
                  />
                </View>
                <View style={[styles.field, styles.fieldFlex]}>
                  <ThemedText style={styles.fieldLabel}>Confirm new password</ThemedText>
                  <Input
                    value={confirmPw}
                    onChangeText={setConfirmPw}
                    secureTextEntry
                    placeholder="Repeat password"
                  />
                </View>
              </View>
              {msg && (
                <ThemedText style={msg.ok ? styles.successText : styles.errorText}>
                  {msg.text}
                </ThemedText>
              )}
              <ButtonRow style={styles.formActions}>
                <Button
                  variant="secondary"
                  tone="neutral"
                  size="md"
                  onPress={() => setShowPwForm(false)}
                  accessibilityLabel="Cancel password change"
                >
                  Cancel
                </Button>
                <Button
                  size="md"
                  onPress={handleChangePw}
                  disabled={saving || !currentPw || newPw.length < 6}
                >
                  {saving ? "Saving…" : "Update Password"}
                </Button>
              </ButtonRow>
            </View>
          )}

          {msg?.ok && (
            <View style={styles.successBanner}>
              <Icon name="checkmark-circle-outline" size="md" color="#16a34a" />
              <ThemedText style={styles.successText}>{msg.text}</ThemedText>
            </View>
          )}
        </>
      </AnimatedAccordion>
    </View>
  );
}
