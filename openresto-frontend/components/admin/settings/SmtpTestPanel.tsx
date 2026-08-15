import { View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { styles } from "./SmtpTestPanel.styles";
import { Icon } from "@/components/common/Icon";

type TestState = "idle" | "testing" | "ok" | "fail";

export interface SmtpTestPanelProps {
  testState: TestState;
  host: string;
  port: string;
  testMsg: string;
  username: string;
  onTest: () => void;
  borderColor: string;
  mutedColor: string;
  cardBg: string;
  surface2: string;
  okColor: string;
  okSoft: string;
  okBorder: string;
  dangerColor: string;
  dangerSoft: string;
  dangerBorder: string;
}

/**
 * The "Test connection" status panel in the EmailSettingsCard right column — circular indicator
 * + status title/description + the Send-test/Re-test button. Presentational: receives testState
 * + host/port/testMsg (for the "Reaching host:port…" subtitle) + an onTest callback.
 */
export function SmtpTestPanel({
  testState,
  host,
  port,
  testMsg,
  username,
  onTest,
  borderColor,
  mutedColor,
  cardBg,
  surface2,
  okColor,
  okSoft,
  okBorder,
  dangerColor,
  dangerSoft,
  dangerBorder,
}: SmtpTestPanelProps) {
  return (
    <View
      style={[
        styles.panel,
        {
          borderColor:
            testState === "ok" ? okBorder : testState === "fail" ? dangerBorder : borderColor,
          backgroundColor:
            testState === "ok" ? okSoft : testState === "fail" ? dangerSoft : surface2,
        },
      ]}
    >
      <View
        style={[
          styles.indicator,
          {
            borderColor:
              testState === "ok" ? okColor : testState === "fail" ? dangerColor : borderColor,
            backgroundColor:
              testState === "ok" ? okColor : testState === "fail" ? dangerColor : cardBg,
          },
        ]}
      >
        {testState === "idle" && <View style={[styles.idleDot, { backgroundColor: mutedColor }]} />}
        {testState === "testing" && <Icon name="reload-outline" size="sm" color={mutedColor} />}
        {testState === "ok" && <Icon name="checkmark" size="md" color="#fff" />}
        {testState === "fail" && <ThemedText style={styles.failMark}>×</ThemedText>}
      </View>

      <View style={styles.copy}>
        <ThemedText style={styles.title}>
          {testState === "idle" && "Not yet tested"}
          {testState === "testing" && "Testing connection…"}
          {testState === "ok" && "Connection successful"}
          {testState === "fail" && "Connection failed"}
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
          {testState === "idle" && "Send a test to verify settings before going live."}
          {testState === "testing" && `Reaching ${host || "host"}:${port}…`}
          {testState === "ok" && (testMsg || "Authentication accepted. Test email delivered.")}
          {testState === "fail" && (testMsg || "Check your credentials and try again.")}
        </ThemedText>
      </View>

      <Button
        variant="secondary"
        size="md"
        icon="flash-outline"
        accessibilityLabel="Send a test email"
        disabled={!host || !username}
        loading={testState === "testing"}
        onPress={() => {
          if (testState !== "testing" && host && username) onTest();
        }}
      >
        {testState === "testing" ? "Testing…" : testState === "ok" ? "Re-test" : "Send test"}
      </Button>
    </View>
  );
}
