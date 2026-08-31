import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { Icon } from "@/components/common/Icon";
import { ModalCard } from "@/components/common/ModalCard";
import { useAppTheme } from "@/hooks/use-app-theme";
import { theme } from "@/theme/theme";
import { COPY_CONFIRMATION_MS, copyToClipboard } from "./clipboard";
import { styles } from "./ApiKeySecretModal.styles";

/**
 * Shown exactly once, immediately after a key is created — the server never returns the full
 * secret again, so this is the one screen that can show it. `secret` lives only in the parent's
 * transient state for as long as this is open; dismissing clears it, and there is nothing here
 * to persist it.
 *
 * That is also why a copy is only ever confirmed once the write resolved: a "Copied" over a
 * clipboard that was never written sends the admin away from the only screen that has the
 * secret. The failure notice stays put until a copy succeeds rather than timing out, because
 * it is an instruction to act on, not a confirmation to acknowledge.
 *
 * @see [ApiKeySecretModal.test.tsx](../../../tests/components/admin/settings/ApiKeySecretModal.test.tsx) —
 * pins that a resolved write confirms and a missing or rejecting clipboard does not.
 */
export function ApiKeySecretModal({
  visible,
  secret,
  onDismiss,
}: {
  visible: boolean;
  secret: string;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    []
  );

  const copied = copyState === "copied";

  const handleCopy = async () => {
    const ok = await copyToClipboard(secret);
    setCopyState(ok ? "copied" : "failed");
    if (!ok) return;
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopyState("idle"), COPY_CONFIRMATION_MS);
  };

  return (
    <ModalCard
      visible={visible}
      title={t("admin.settings.apiKeys.secretModal.title")}
      onDismiss={onDismiss}
      alert
      dismissLabel={t("admin.settings.apiKeys.secretModal.doneButton")}
      testID="api-key-secret-modal"
    >
      <View
        style={[
          styles.warning,
          { borderColor: theme.colors.warning, backgroundColor: `${theme.colors.warning}14` },
        ]}
      >
        <Icon
          name="warning-outline"
          size="sm"
          color={theme.colors.warning}
          style={styles.warningIcon}
        />
        <ThemedText style={styles.warningText}>
          {t("admin.settings.apiKeys.secretModal.warning")}
        </ThemedText>
      </View>

      <View
        style={[
          styles.secretRow,
          { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
        ]}
      >
        <ThemedText style={styles.secretText} selectable testID="api-key-secret-value">
          {secret}
        </ThemedText>
        {Platform.OS === "web" && (
          <Button
            variant="ghost"
            size="sm"
            tone="neutral"
            icon={copied ? "checkmark" : "copy-outline"}
            onPress={handleCopy}
            accessibilityLabel={
              copied
                ? t("admin.settings.apiKeys.secretModal.copiedLabel")
                : t("admin.settings.apiKeys.secretModal.copyLabel")
            }
          >
            {copied
              ? t("admin.settings.apiKeys.secretModal.copiedButton")
              : t("admin.settings.apiKeys.secretModal.copyButton")}
          </Button>
        )}
      </View>

      {copyState === "failed" && (
        <ThemedText
          style={[styles.copyFailed, { color: theme.colors.error }]}
          testID="api-key-secret-copy-failed"
        >
          {t("admin.settings.apiKeys.secretModal.copyFailed")}
        </ThemedText>
      )}

      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        <Button size="md" onPress={onDismiss}>
          {t("admin.settings.apiKeys.secretModal.doneButton")}
        </Button>
      </View>
    </ModalCard>
  );
}

export default ApiKeySecretModal;
