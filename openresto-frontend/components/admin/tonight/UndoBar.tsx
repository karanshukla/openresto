import { useEffect } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import IconButton from "@/components/common/IconButton";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./UndoBar.styles";

/** How long the bar stays up; the server keeps the undo open far longer, for a mis-tap noticed late. */
export const UNDO_BAR_MS = 10_000;

/**
 * Confirms the last tap and offers to take it back, instead of asking first. Hosts press fast,
 * so a confirm before every move costs more than an undo after the rare wrong one.
 *
 * @see [UndoBar.test.tsx](../../../tests/components/admin/tonight/UndoBar.test.tsx) — pins Undo
 * shown only when there is a move to take back, and the bar dismissing itself.
 */
export function UndoBar({
  message,
  onUndo,
  onDismiss,
}: {
  message: string;
  onUndo?: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();

  useEffect(() => {
    const timer = setTimeout(onDismiss, UNDO_BAR_MS);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <View
      testID="undo-bar"
      role="status"
      accessibilityLiveRegion="polite"
      style={[styles.bar, { backgroundColor: colors.card, borderColor: colors.borderStrong }]}
    >
      <ThemedText style={styles.message} numberOfLines={2}>
        {message}
      </ThemedText>
      {onUndo && (
        <Button
          size="md"
          variant="secondary"
          icon="arrow-undo-outline"
          onPress={onUndo}
          accessibilityLabel={t("admin.tonight.done.undoLabel", { message })}
          testID="undo-bar-undo"
        >
          {t("admin.tonight.done.undo")}
        </Button>
      )}
      <IconButton
        name="close"
        color={colors.muted}
        accessibilityLabel={t("admin.tonight.done.dismiss")}
        onPress={onDismiss}
        testID="undo-bar-dismiss"
      />
    </View>
  );
}
