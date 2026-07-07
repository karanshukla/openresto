import { View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/themed-text";
import { styles } from "./settings.styles";

type TestState = "idle" | "testing" | "ok" | "fail";

export interface SmtpTestPanelProps {
  testState: TestState;
  host: string;
  port: string;
  testMsg: string;
  username: string;
  onTest: () => void;
  // Theme values (presentational).
  borderColor: string;
  mutedColor: string;
  primaryColor: string;
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
 * + host/port/testMsg (for the "Reaching host:port…" subtitle) + an onTest callback. Extracted
 * during Bundle 9B-2 decomposition.
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
  primaryColor,
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
        backgroundColor: testState === "ok" ? okSoft : testState === "fail" ? dangerSoft : surface2,
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
        {testState === "testing" && <Ionicons name="reload-outline" size={14} color={mutedColor} />}
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
          if (testState !== "testing" && host && username) onTest();
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
  );
}
