import { useState, useEffect } from "react";
import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Input from "@/components/common/Input";
import Button from "@/components/common/Button";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/theme/theme";
import { getPvqStatus, setupPvq, changePassword, PvqStatus } from "@/api/auth";
import { styles } from "./settings.styles";

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
  const [showPvqForm, setShowPvqForm] = useState(false);
  const [showPwForm, setShowPwForm] = useState(false);
  const [pvqQuestion, setPvqQuestion] = useState("");
  const [pvqAnswer, setPvqAnswer] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    getPvqStatus().then(setPvqStatus);
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

  const handleChangePw = async () => {
    if (newPw !== confirmPw) {
      setMsg({ text: "Passwords do not match.", ok: false });
      return;
    }
    if (newPw.length < 6) {
      setMsg({ text: "Password must be at least 6 characters.", ok: false });
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
    <View style={[styles.secCard, { backgroundColor: cardBg, borderColor }]}>
      <View style={styles.secHeader}>
        <View style={[styles.secIcon, { backgroundColor: `${COLORS.primary}14` }]}>
          <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.secTitle}>Account Security</ThemedText>
          <ThemedText style={[styles.secSub, { color: mutedColor }]}>
            Manage your password and identity verification
          </ThemedText>
        </View>
      </View>

      {/* PVQ status row */}
      <View style={[styles.secRow, { borderTopColor: borderColor }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <ThemedText style={styles.secRowTitle}>Security Question</ThemedText>
          {pvqStatus?.isConfigured ? (
            <ThemedText style={[styles.secRowSub, { color: mutedColor }]} numberOfLines={1}>
              {pvqStatus.question}
            </ThemedText>
          ) : (
            <ThemedText style={[styles.secRowSub, { color: COLORS.warning }]}>
              Not configured — set one up to enable password reset
            </ThemedText>
          )}
        </View>
        <Pressable
          style={[styles.secBtn, { borderColor }]}
          onPress={() => {
            setShowPvqForm((v) => !v);
            setShowPwForm(false);
            setMsg(null);
          }}
        >
          <ThemedText style={[styles.secBtnText, { color: COLORS.primary }]}>
            {pvqStatus?.isConfigured ? "Change" : "Set up"}
          </ThemedText>
        </Pressable>
      </View>

      {showPvqForm && (
        <View style={[styles.secForm, { borderTopColor: borderColor }]}>
          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>Security question</ThemedText>
            <Input
              value={pvqQuestion}
              onChangeText={setPvqQuestion}
              placeholder="e.g. What was the name of your first pet?"
            />
          </View>
          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>Answer (not case-sensitive)</ThemedText>
            <Input
              value={pvqAnswer}
              onChangeText={setPvqAnswer}
              placeholder="Your answer"
              autoCapitalize="none"
            />
          </View>
          {msg && !msg.ok && <ThemedText style={styles.errorText}>{msg.text}</ThemedText>}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            <Button
              onPress={handleSavePvq}
              disabled={saving || !pvqQuestion.trim() || !pvqAnswer.trim()}
              style={{ flex: 1 }}
            >
              {saving ? "Saving…" : "Save Question"}
            </Button>
            <Pressable style={styles.smallBtn} onPress={() => setShowPvqForm(false)}>
              <ThemedText style={[styles.smallBtnText, { color: mutedColor }]}>Cancel</ThemedText>
            </Pressable>
          </View>
        </View>
      )}

      {/* Password row */}
      <View style={[styles.secRow, { borderTopColor: borderColor }]}>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.secRowTitle}>Password</ThemedText>
          <ThemedText style={[styles.secRowSub, { color: mutedColor }]}>
            Change your admin password
          </ThemedText>
        </View>
        <Pressable
          style={[styles.secBtn, { borderColor }]}
          onPress={() => {
            setShowPwForm((v) => !v);
            setShowPvqForm(false);
            setMsg(null);
          }}
        >
          <ThemedText style={[styles.secBtnText, { color: COLORS.primary }]}>Change</ThemedText>
        </Pressable>
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
          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>New password</ThemedText>
            <Input
              value={newPw}
              onChangeText={setNewPw}
              secureTextEntry
              placeholder="At least 6 characters"
            />
          </View>
          <View style={styles.field}>
            <ThemedText style={styles.fieldLabel}>Confirm new password</ThemedText>
            <Input
              value={confirmPw}
              onChangeText={setConfirmPw}
              secureTextEntry
              placeholder="Repeat password"
            />
          </View>
          {msg && (
            <ThemedText style={msg.ok ? styles.successText : styles.errorText}>
              {msg.text}
            </ThemedText>
          )}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
            <Button
              onPress={handleChangePw}
              disabled={saving || !currentPw || newPw.length < 6}
              style={{ flex: 1 }}
            >
              {saving ? "Saving…" : "Update Password"}
            </Button>
            <Pressable style={styles.smallBtn} onPress={() => setShowPwForm(false)}>
              <ThemedText style={[styles.smallBtnText, { color: mutedColor }]}>Cancel</ThemedText>
            </Pressable>
          </View>
        </View>
      )}

      {msg?.ok && (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle-outline" size={16} color="#16a34a" />
          <ThemedText style={styles.successText}>{msg.text}</ThemedText>
        </View>
      )}
    </View>
  );
}
