import { View } from "react-native";
import { haptics } from "@/utils/haptics";
import { useTranslation } from "react-i18next";
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
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("common.confirmModal.defaultTitle");
  const resolvedConfirmLabel = confirmLabel ?? t("common.actions.confirm");
  const resolvedCancelLabel = cancelLabel ?? t("common.actions.cancel");

  const handleConfirm = () => {
    haptics.outcome(destructive ? "warning" : "success");
    onConfirm();
  };

  return (
    <ModalCard
      visible={visible}
      title={resolvedTitle}
      onDismiss={onCancel}
      alert
      dismissLabel={resolvedCancelLabel}
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
          {resolvedCancelLabel}
        </Button>
        <Button
          variant={destructive ? "danger" : "primary"}
          size="md"
          onPress={handleConfirm}
          style={styles.action}
        >
          {resolvedConfirmLabel}
        </Button>
      </View>
    </ModalCard>
  );
}
