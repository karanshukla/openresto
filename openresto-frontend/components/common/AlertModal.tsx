import { useTranslation } from "react-i18next";
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
  title,
  message,
  buttonLabel,
  onClose,
}: AlertModalProps) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();

  return (
    <ModalCard
      visible={visible}
      title={title ?? t("common.alertModal.defaultTitle")}
      onDismiss={onClose}
      alert
      dismissLabel={t("common.actions.close")}
    >
      <ThemedText style={[styles.message, { color: colors.muted }]}>{message}</ThemedText>
      <Button size="md" onPress={onClose} style={styles.action}>
        {buttonLabel ?? t("common.alertModal.defaultButtonLabel")}
      </Button>
    </ModalCard>
  );
}
