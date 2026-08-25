import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
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
import { AccordionCardHeader } from "./AccordionCardHeader";
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
  const { t } = useTranslation();
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
      <AccordionCardHeader
        icon="shield-checkmark-outline"
        title={t("admin.settings.security.title")}
        subtitle={t("admin.settings.security.subtitle")}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        primaryColor={primaryColor}
        mutedColor={mutedColor}
      />

      <AnimatedAccordion expanded={expanded}>
        <>
          <View style={[styles.secRow, { borderTopColor: borderColor }]}>
            <View style={styles.secRowCopy}>
              <ThemedText style={styles.secRowTitle}>
                {t("admin.settings.security.emailLabel")}
              </ThemedText>
              <ThemedText style={[styles.secRowSub, { color: mutedColor }]} numberOfLines={1}>
                {email ?? t("common.status.loading")}
              </ThemedText>
            </View>
            <Button
              testID="email-change-button"
              variant="secondary"
              size="md"
              accessibilityLabel={t("admin.settings.security.changeEmailLabel")}
              accessibilityState={{ expanded: showEmailForm }}
              onPress={() => {
                setShowEmailForm((v) => !v);
                setShowPvqForm(false);
                setShowPwForm(false);
                setMsg(null);
              }}
            >
              {t("admin.settings.security.change")}
            </Button>
          </View>

          {showEmailForm && (
            <View style={[styles.secForm, { borderTopColor: borderColor }]}>
              <View style={styles.fieldRow}>
                <View style={[styles.field, styles.fieldFlex]}>
                  <ThemedText style={styles.fieldLabel}>
                    {t("admin.settings.security.newEmailLabel")}
                  </ThemedText>
                  <Input
                    value={newEmail}
                    onChangeText={setNewEmail}
                    placeholder={t("admin.settings.security.newEmailPlaceholder")}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
                <View style={[styles.field, styles.fieldFlex]}>
                  <ThemedText style={styles.fieldLabel}>
                    {t("admin.settings.security.currentPasswordLabel")}
                  </ThemedText>
                  <Input
                    value={currentPwForEmail}
                    onChangeText={setCurrentPwForEmail}
                    secureTextEntry
                    placeholder={t("admin.settings.security.passwordPlaceholder")}
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
                  accessibilityLabel={t("admin.settings.security.cancelEmailLabel")}
                >
                  {t("common.actions.cancel")}
                </Button>
                <Button
                  size="md"
                  onPress={handleChangeEmail}
                  disabled={saving || !newEmail.trim() || !currentPwForEmail}
                >
                  {saving
                    ? t("admin.settings.security.saving")
                    : t("admin.settings.security.updateEmail")}
                </Button>
              </ButtonRow>
            </View>
          )}

          <View style={[styles.secRow, { borderTopColor: borderColor }]}>
            <View style={[styles.secRowCopy, styles.policyHeaderCopy]}>
              <ThemedText style={styles.secRowTitle}>
                {t("admin.settings.security.pvqLabel")}
              </ThemedText>
              {pvqStatus?.isConfigured ? (
                <ThemedText style={[styles.secRowSub, { color: mutedColor }]} numberOfLines={1}>
                  {pvqStatus.question}
                </ThemedText>
              ) : (
                <ThemedText style={[styles.secRowSub, { color: theme.colors.warning }]}>
                  {t("admin.settings.security.pvqNotConfigured")}
                </ThemedText>
              )}
            </View>
            <Button
              variant="secondary"
              size="md"
              accessibilityLabel={t("admin.settings.security.changePvqLabel")}
              accessibilityState={{ expanded: showPvqForm }}
              onPress={() => {
                setShowPvqForm((v) => !v);
                setShowPwForm(false);
                setShowEmailForm(false);
                setMsg(null);
              }}
            >
              {pvqStatus?.isConfigured
                ? t("admin.settings.security.change")
                : t("admin.settings.security.setUp")}
            </Button>
          </View>

          {showPvqForm && (
            <View style={[styles.secForm, { borderTopColor: borderColor }]}>
              <View style={styles.fieldRow}>
                <View style={[styles.field, styles.fieldFlex]}>
                  <ThemedText style={styles.fieldLabel}>
                    {t("admin.settings.security.pvqQuestionLabel")}
                  </ThemedText>
                  <Input
                    value={pvqQuestion}
                    onChangeText={setPvqQuestion}
                    placeholder={t("admin.settings.security.pvqQuestionPlaceholder")}
                  />
                </View>
                <View style={[styles.field, styles.fieldFlex]}>
                  <ThemedText style={styles.fieldLabel}>
                    {t("admin.settings.security.pvqAnswerLabel")}
                  </ThemedText>
                  <Input
                    value={pvqAnswer}
                    onChangeText={setPvqAnswer}
                    placeholder={t("admin.settings.security.pvqAnswerPlaceholder")}
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
                  accessibilityLabel={t("admin.settings.security.cancelPvqLabel")}
                >
                  {t("common.actions.cancel")}
                </Button>
                <Button
                  size="md"
                  onPress={handleSavePvq}
                  disabled={saving || !pvqQuestion.trim() || !pvqAnswer.trim()}
                >
                  {saving
                    ? t("admin.settings.security.saving")
                    : t("admin.settings.security.saveQuestion")}
                </Button>
              </ButtonRow>
            </View>
          )}

          <View style={[styles.secRow, { borderTopColor: borderColor }]}>
            <View style={styles.secRowCopy}>
              <ThemedText style={styles.secRowTitle}>
                {t("admin.settings.security.passwordLabel")}
              </ThemedText>
              <ThemedText style={[styles.secRowSub, { color: mutedColor }]}>
                {t("admin.settings.security.passwordSubtitle")}
              </ThemedText>
            </View>
            <Button
              variant="secondary"
              size="md"
              accessibilityLabel={t("admin.settings.security.changePasswordLabel")}
              accessibilityState={{ expanded: showPwForm }}
              onPress={() => {
                setShowPwForm((v) => !v);
                setShowPvqForm(false);
                setShowEmailForm(false);
                setMsg(null);
              }}
            >
              {t("admin.settings.security.change")}
            </Button>
          </View>

          {showPwForm && (
            <View style={[styles.secForm, { borderTopColor: borderColor }]}>
              <View style={styles.field}>
                <ThemedText style={styles.fieldLabel}>
                  {t("admin.settings.security.currentPasswordLabel")}
                </ThemedText>
                <Input
                  value={currentPw}
                  onChangeText={setCurrentPw}
                  secureTextEntry
                  placeholder={t("admin.settings.security.passwordPlaceholder")}
                />
              </View>
              <View style={styles.fieldRow}>
                <View style={[styles.field, styles.fieldFlex]}>
                  <ThemedText style={styles.fieldLabel}>
                    {t("admin.settings.security.newPasswordLabel")}
                  </ThemedText>
                  <Input
                    value={newPw}
                    onChangeText={setNewPw}
                    secureTextEntry
                    placeholder={t("admin.settings.security.newPasswordPlaceholder")}
                  />
                </View>
                <View style={[styles.field, styles.fieldFlex]}>
                  <ThemedText style={styles.fieldLabel}>
                    {t("admin.settings.security.confirmPasswordLabel")}
                  </ThemedText>
                  <Input
                    value={confirmPw}
                    onChangeText={setConfirmPw}
                    secureTextEntry
                    placeholder={t("admin.settings.security.confirmPasswordPlaceholder")}
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
                  accessibilityLabel={t("admin.settings.security.cancelPasswordLabel")}
                >
                  {t("common.actions.cancel")}
                </Button>
                <Button
                  size="md"
                  onPress={handleChangePw}
                  disabled={saving || !currentPw || newPw.length < 6}
                >
                  {saving
                    ? t("admin.settings.security.saving")
                    : t("admin.settings.security.updatePassword")}
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
