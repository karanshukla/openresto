import { StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";
import Button from "@/components/common/Button";
import { ModalCard } from "@/components/common/ModalCard";
import { theme } from "@/theme/theme";
import { useAppTheme } from "@/hooks/use-app-theme";

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

const styles = StyleSheet.create({
  message: {
    ...theme.typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  action: {
    marginTop: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
  },
});
