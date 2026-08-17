import { View } from "react-native";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { ModalCard } from "@/components/common/ModalCard";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./ConfirmModal.styles";

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
        {/* Neutral, like every other dismissing action in the app: a brand-toned Cancel
            competes with the button it is meant to sit beside. */}
        <Button
          variant="secondary"
          tone="neutral"
          size="md"
          onPress={onCancel}
          style={styles.action}
        >
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
