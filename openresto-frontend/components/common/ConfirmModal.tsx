import { StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { ModalCard } from "@/components/common/ModalCard";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";

interface ConfirmModalProps {
  visible: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  visible,
  title = "Confirm",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { colors } = useAppTheme();

  const handleConfirm = () => {
    Haptics.notificationAsync(
      destructive
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Success
    );
    onConfirm();
  };

  return (
    <ModalCard
      visible={visible}
      title={title}
      onDismiss={onCancel}
      alert
      dismissLabel={cancelLabel}
    >
      <ThemedText style={[styles.message, { color: colors.muted }]}>{message}</ThemedText>
      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        <Button variant="secondary" size="md" onPress={onCancel} style={styles.action}>
          {cancelLabel}
        </Button>
        <Button
          variant={destructive ? "danger" : "primary"}
          size="md"
          onPress={handleConfirm}
          style={styles.action}
        >
          {confirmLabel}
        </Button>
      </View>
    </ModalCard>
  );
}

const styles = StyleSheet.create({
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.xsm,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
  },
  action: {
    flex: 1,
    borderRadius: theme.borderRadius.lg,
  },
});
