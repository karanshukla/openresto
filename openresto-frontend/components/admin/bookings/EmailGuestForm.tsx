import { View, Pressable } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "@/theme/theme";
import { bookingDetailStyles as styles } from "./booking-detail.styles";

interface EmailGuestFormProps {
  borderColor: string;
  mutedColor: string;
  isDark: boolean;
  colors: any;
  customerEmail: string;
  emailSubject: string;
  emailBody: string;
  emailSending: boolean;
  emailResult: { ok: boolean; message: string } | null;
  setEmailSubject: (s: string) => void;
  setEmailBody: (b: string) => void;
  onSendEmail: () => void;
}

export function EmailGuestForm({
  borderColor,
  mutedColor,
  isDark,
  colors,
  customerEmail,
  emailSubject,
  emailBody,
  emailSending,
  emailResult,
  setEmailSubject,
  setEmailBody,
  onSendEmail,
}: EmailGuestFormProps) {
  return (
    <View style={[styles.section, { borderColor }]}>
      <View style={styles.sectionHeader}>
        <Ionicons name="mail-outline" size={16} color={mutedColor} />
        <ThemedText style={[styles.sectionTitle, { color: mutedColor }]}>Email guest</ThemedText>
      </View>
      <ThemedText style={[styles.emailTo, { color: mutedColor }]}>
        To: {customerEmail}
      </ThemedText>
      <input
        type="text"
        placeholder="Subject"
        value={emailSubject}
        onChange={(e) => setEmailSubject(e.target.value)}
        style={{
          width: "100%",
          height: 40,
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
          borderRadius: 8,
          paddingLeft: 12,
          paddingRight: 12,
          fontSize: 14,
          backgroundColor: colors.input,
          color: colors.text,
          marginBottom: 8,
        } as React.CSSProperties}
      />
      <textarea
        placeholder="Message body (HTML supported)"
        value={emailBody}
        onChange={(e) => setEmailBody(e.target.value)}
        rows={4}
        style={{
          width: "100%",
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: colors.border,
          borderRadius: 8,
          padding: 12,
          fontSize: 14,
          backgroundColor: colors.input,
          color: colors.text,
          resize: "vertical",
          fontFamily: "inherit",
          marginBottom: 8,
        } as React.CSSProperties}
      />
      <View style={styles.emailActions}>
        <Pressable
          style={[
            styles.emailSendBtn,
            { backgroundColor: COLORS.primary },
            (!emailSubject.trim() || !emailBody.trim() || emailSending) && { opacity: 0.5 },
          ]}
          onPress={onSendEmail}
          disabled={!emailSubject.trim() || !emailBody.trim() || emailSending}
        >
          <Ionicons name="send-outline" size={14} color="#fff" />
          <ThemedText style={styles.emailSendBtnText}>
            {emailSending ? "Sending…" : "Send Email"}
          </ThemedText>
        </Pressable>
        {emailResult && (
          <ThemedText
            style={[styles.emailResultText, { color: emailResult.ok ? COLORS.success : COLORS.error }]}
          >
            {emailResult.message}
          </ThemedText>
        )}
      </View>
    </View>
  );
}
