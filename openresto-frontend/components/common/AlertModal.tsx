import { Modal, Pressable, StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/themed-text";
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
  const { colors, primaryColor } = useAppTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ThemedText type="h3">{title}</ThemedText>
          <ThemedText style={[styles.message, { color: colors.muted }]}>{message}</ThemedText>
          <Pressable style={[styles.btn, { backgroundColor: primaryColor }]} onPress={onClose}>
            <ThemedText style={styles.btnText}>{buttonLabel}</ThemedText>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.spacing.xxl,
  },
  card: {
    borderRadius: theme.borderRadius.modal,
    borderWidth: 1,
    padding: theme.spacing.xxl,
    width: "100%",
    maxWidth: 400,
    gap: theme.spacing.md,
    ...theme.shadows.popup,
  },
  message: {
    ...theme.typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  btn: {
    paddingVertical: 11,
    borderRadius: theme.borderRadius.lg,
    alignItems: "center",
    marginTop: theme.spacing.sm,
  },
  btnText: {
    color: theme.colors.white,
    ...theme.typography.bodyBold,
    fontWeight: "700",
  },
});
