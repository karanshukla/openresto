import { View } from "react-native";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
          {testState === "idle" && t("admin.settings.smtpTest.idleTitle")}
          {testState === "testing" && t("admin.settings.smtpTest.testingTitle")}
          {testState === "ok" && t("admin.settings.smtpTest.okTitle")}
          {testState === "fail" && t("admin.settings.smtpTest.failTitle")}
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
          {testState === "idle" && t("admin.settings.smtpTest.idleSubtitle")}
          {testState === "testing" &&
            t("admin.settings.smtpTest.testingSubtitle", {
              host: host || t("admin.settings.smtpTest.hostFallback"),
              port,
            })}
          {testState === "ok" && (testMsg || t("admin.settings.smtpTest.okFallback"))}
          {testState === "fail" && (testMsg || t("admin.settings.smtpTest.failFallback"))}
        </ThemedText>
      </View>

      <Button
        variant="secondary"
        size="md"
        icon="flash-outline"
        accessibilityLabel={t("admin.settings.smtpTest.sendTestLabel")}
        disabled={!host || !username}
        loading={testState === "testing"}
        onPress={() => {
          if (testState !== "testing" && host && username) onTest();
        }}
      >
        {testState === "testing"
          ? t("admin.settings.smtpTest.testingButton")
          : testState === "ok"
            ? t("admin.settings.smtpTest.retestButton")
            : t("admin.settings.smtpTest.sendTestButton")}
      </Button>
    </View>
  );
}
