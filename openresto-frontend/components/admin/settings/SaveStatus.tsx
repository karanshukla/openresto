import { ActivityIndicator, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { Icon } from "@/components/common/Icon";
import { theme } from "@/theme/theme";
import type { AutosaveStatus } from "@/hooks/use-autosave";
import { styles } from "./SaveStatus.styles";

/**
 * What a card says instead of having a Save button: the outcome of its own autosave, in the
 * corner the Save button used to occupy. The row keeps its height while idle so a card doesn't
 * jump as the state cycles, and it is a live region so the outcome is announced rather than
 * only seen — with no button to press, that announcement is the only confirmation there is.
 */
export function SaveStatus({
  status,
  error,
  onRetry,
  onUndo,
  mutedColor,
  blockedReason,
  testID = "save-status",
}: {
  status: AutosaveStatus;
  error?: string | null;
  onRetry: () => void;
  /**
   * Puts back what the last save replaced. Null when there is nothing to undo, which is the
   * usual state — the offer only stands for a few seconds after a write lands. This is the
   * closest thing an autosaved form has to the Discard button it no longer needs.
   */
  onUndo?: (() => void) | null;
  mutedColor: string;
  /**
   * Why the card is holding the write back (a `canSave` that is currently false). Without it a
   * withheld save is indistinguishable from a broken one: nothing happens, and the admin has no
   * way to know it's their half-typed value rather than the feature. It outranks every state but
   * an in-flight save, which is still the truthful thing to report while one is running.
   */
  blockedReason?: string | null;
  testID?: string;
}) {
  if (blockedReason && status !== "saving") {
    return (
      <View testID={testID} style={styles.row} accessibilityLiveRegion="polite" role="status">
        <Icon name="alert-circle-outline" size="sm" color={theme.colors.warning} />
        <ThemedText style={[styles.text, styles.errorText, { color: theme.colors.warning }]}>
          {blockedReason}
        </ThemedText>
      </View>
    );
  }

  return (
    <View testID={testID} style={styles.row} accessibilityLiveRegion="polite" role="status">
      {status === "saving" && (
        <>
          <ActivityIndicator size="small" color={mutedColor} />
          <ThemedText style={[styles.text, { color: mutedColor }]}>Saving…</ThemedText>
        </>
      )}
      {status === "saved" && (
        <>
          <Icon name="checkmark-circle" size="sm" color={theme.colors.success} />
          <ThemedText style={[styles.text, { color: theme.colors.success }]}>Saved</ThemedText>
          {onUndo && (
            <Button
              variant="ghost"
              tone="neutral"
              size="sm"
              onPress={onUndo}
              accessibilityLabel="Undo the last save"
            >
              Undo
            </Button>
          )}
        </>
      )}
      {status === "error" && (
        <>
          <Icon name="alert-circle" size="sm" color={theme.colors.error} />
          <ThemedText style={[styles.text, styles.errorText, { color: theme.colors.error }]}>
            {error || "Save failed"}
          </ThemedText>
          <Button
            variant="ghost"
            tone="danger"
            size="sm"
            onPress={onRetry}
            accessibilityLabel="Retry saving"
          >
            Retry
          </Button>
        </>
      )}
    </View>
  );
}

export default SaveStatus;
