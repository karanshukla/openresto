import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { EmailSettingsState } from "@/hooks/use-email-settings";
import { SmtpTestPanel } from "./SmtpTestPanel";
import { EmailFailuresList } from "./EmailFailuresList";
import { Icon } from "@/components/common/Icon";
import { styles } from "./EmailDeliveryPanel.styles";

/**
 * The companion panel to the SMTP form: whether the connection works, and what has failed to send
 * recently. It sticks beside the form rather than sitting under it, because "did my change fix the
 * connection" is a question you ask while editing the fields, not after scrolling past them.
 */
export function EmailDeliveryPanel({
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
  const { primaryColor } = useAppTheme();
  const surface2 = isDark ? "#252729" : "#f9fafb";
  const okColor = theme.colors.success;
  const okSoft = isDark ? `${okColor}22` : "#dcfce7";
  const okBorder = `${okColor}50`;
  const dangerColor = theme.colors.error;
  const dangerSoft = isDark ? `${dangerColor}22` : "#fef2f2";
  const dangerBorder = `${dangerColor}50`;

  const { host, port, username, testState, testMsg, handleTest, failures } = email;

  return (
    <View style={[styles.panel, { backgroundColor: cardBg, borderColor }]}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: `${primaryColor}18` }]}>
          <Icon name="pulse-outline" size="xl" color={primaryColor} />
        </View>
        <View style={styles.headerCopy}>
          <ThemedText style={styles.headerTitle}>Delivery</ThemedText>
          <ThemedText style={[styles.headerSub, { color: mutedColor }]}>
            {failures.length > 0
              ? `${failures.length} recent failure${failures.length !== 1 ? "s" : ""}`
              : "Connection and send history"}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.body, { borderTopColor: borderColor }]}>
        <SmtpTestPanel
          testState={testState}
          host={host}
          port={port}
          testMsg={testMsg}
          username={username}
          onTest={handleTest}
          borderColor={borderColor}
          mutedColor={mutedColor}
          cardBg={cardBg}
          surface2={surface2}
          okColor={okColor}
          okSoft={okSoft}
          okBorder={okBorder}
          dangerColor={dangerColor}
          dangerSoft={dangerSoft}
          dangerBorder={dangerBorder}
        />

        <EmailFailuresList
          failures={failures}
          mutedColor={mutedColor}
          dangerBorder={dangerBorder}
          dangerSoft={dangerSoft}
          dangerColor={dangerColor}
        />
      </View>
    </View>
  );
}
