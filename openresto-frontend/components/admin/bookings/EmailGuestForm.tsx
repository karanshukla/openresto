import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/theme/theme";
import { bookingDetailStyles as styles } from "./booking-detail.styles";
import Button from "@/components/common/Button";
import { Icon } from "@/components/common/Icon";

interface ThemeColors {
  input: string;
  text: string;
  border: string;
}

interface EmailGuestFormProps {
  /** The sitting just moved and a notice has been written into the fields below, unsent. */
  moveNoticeReady?: boolean;
  borderColor: string;
  mutedColor: string;
  isDark: boolean;
  colors: ThemeColors;
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
  moveNoticeReady = false,
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
        <Icon name="mail-outline" size="md" color={mutedColor} />
        <ThemedText style={[styles.sectionTitle, { color: mutedColor }]}>Email guest</ThemedText>
      </View>
      <ThemedText style={[styles.emailTo, { color: mutedColor }]}>To: {customerEmail}</ThemedText>
      {moveNoticeReady && (
        <ThemedText
          testID="move-notice-ready"
          style={[styles.emailTo, { color: theme.colors.warning }]}
        >
          The sitting moved. A notice is written below and has not been sent: edit it, or send it as
          it stands.
        </ThemedText>
      )}
      <input
        type="text"
        placeholder="Subject"
        value={emailSubject}
        onChange={/* istanbul ignore next */ (e) => setEmailSubject(e.target.value)}
        style={
          {
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
          } as React.CSSProperties
        }
      />
      <textarea
        placeholder="Message body (HTML supported)"
        value={emailBody}
        onChange={/* istanbul ignore next */ (e) => setEmailBody(e.target.value)}
        rows={4}
        style={
          {
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
          } as React.CSSProperties
        }
      />
      <View style={styles.emailActions}>
        <Button
          size="md"
          icon="send-outline"
          onPress={onSendEmail}
          accessibilityLabel="Send email to guest"
          disabled={!emailSubject.trim() || !emailBody.trim() || emailSending}
          loading={emailSending}
        >
          {emailSending ? "Sending…" : "Send Email"}
        </Button>
        {emailResult && (
          <ThemedText
            style={[
              styles.emailResultText,
              { color: emailResult.ok ? theme.colors.success : theme.colors.error },
            ]}
          >
            {emailResult.message}
          </ThemedText>
        )}
      </View>
    </View>
  );
}
