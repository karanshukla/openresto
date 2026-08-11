import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { ModalCard } from "@/components/common/ModalCard";
import { useAppTheme } from "@/hooks/use-app-theme";
import { styles } from "./AlertModal.styles";

interface AlertModalProps {
  visible: boolean;
  title?: string;
  message: string;
  buttonLabel?: string;
  onClose: () => void;
}

export default function AlertModal({
  visible,
  title = "Notice",
  message,
  buttonLabel = "OK",
  onClose,
}: AlertModalProps) {
  const { colors } = useAppTheme();

  return (
    <ModalCard visible={visible} title={title} onDismiss={onClose} alert dismissLabel="Close">
      <ThemedText style={[styles.message, { color: colors.muted }]}>{message}</ThemedText>
      <Button size="md" onPress={onClose} style={styles.action}>
        {buttonLabel}
      </Button>
    </ModalCard>
  );
}
